/**
 * CinemaHalal Streaming Server
 * ============================
 *
 * NOTE (Node 22+): WebTorrent pulls in an ESM dependency graph that uses
 * top-level await. This file is written as ESM (see package.json "type":"module")
 * so imports work reliably.
 */

import './polyfill.js';
import express from 'express';
import cors from 'cors';
import WebTorrent from 'webtorrent';
import mime from 'mime-types';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

const app = express();
const PORT = process.env.PORT || 3001;

// WebTorrent client with full capabilities (DHT, UDP trackers, etc.)
const client = new WebTorrent({
    maxConns: 100,
    dht: true,
    webSeeds: true
});

function destroyTorrentSafe(torrent) {
    try {
        if (!torrent) return;
        if (typeof torrent.destroy === 'function') {
            torrent.destroy();
            return;
        }
        // Some builds expose removal via the client instead.
        const id = torrent.infoHash || torrent.magnetURI;
        if (id && typeof client.remove === 'function') {
            client.remove(id, () => {});
        }
    } catch (e) {
        // Best-effort cleanup only.
    }
}

function onOnce(emitter, eventName, handler) {
    if (!emitter || typeof handler !== 'function') return () => {};
    if (typeof emitter.once === 'function') {
        emitter.once(eventName, handler);
        return () => {};
    }
    if (typeof emitter.on === 'function' && typeof emitter.off === 'function') {
        const wrapped = (...args) => {
            try {
                emitter.off(eventName, wrapped);
            } catch {
                // ignore
            }
            handler(...args);
        };
        emitter.on(eventName, wrapped);
        return () => {
            try {
                emitter.off(eventName, wrapped);
            } catch {
                // ignore
            }
        };
    }
    if (typeof emitter.on === 'function' && typeof emitter.removeListener === 'function') {
        const wrapped = (...args) => {
            try {
                emitter.removeListener(eventName, wrapped);
            } catch {
                // ignore
            }
            handler(...args);
        };
        emitter.on(eventName, wrapped);
        return () => {
            try {
                emitter.removeListener(eventName, wrapped);
            } catch {
                // ignore
            }
        };
    }

    // Nothing we can do.
    return () => {};
}

// Active streams cache: { infoHash: { torrent, videoFile, lastAccess } }
const activeStreams = new Map();

// Cleanup inactive streams every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INACTIVE_TIMEOUT = 15 * 60 * 1000; // 15 minutes of inactivity

// Known working trackers (mix of UDP, HTTP, and WebSocket)
const TRACKERS = [
    // Best UDP Trackers
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.bittor.pw:1337/announce',
    'udp://public.popcorn-tracker.org:6969/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.moeking.me:6969/announce',
    'udp://explodie.org:6969/announce',
    'udp://9.rarbg.me:2970/announce',
    'udp://9.rarbg.to:2710/announce',
    'udp://tracker.coppersurfer.tk:6969/announce',
    'udp://tracker.leechers-paradise.org:6969/announce',
    'udp://tracker.internetwarriors.net:1337/announce',
    'udp://tracker.cyberia.is:6969/announce',
    'udp://tracker.pirateparty.gr:6969/announce',
    'udp://tracker.tiny-vps.com:6969/announce',
    'udp://tracker.zer0day.to:1337/announce',
    'udp://tracker.leechers-paradise.org:6969/announce',
    'udp://coppersurfer.tk:6969/announce',
    
    // HTTP Trackers
    'http://tracker.opentrackr.org:1337/announce',
    'http://tracker.openbittorrent.com:80/announce',
    'http://tracker.internetwarriors.net:1337/announce',
    'http://tracker.leechers-paradise.org:6969/announce',
    'http://tracker.coppersurfer.tk:6969/announce',
    
    // WebSocket trackers (for hybrid browser/server support)
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.btorrent.xyz',
    'wss://tracker.files.fm:7073/announce'
];

const DEFAULT_HEADERS = {
    // Some torrent sites serve different content based on UA.
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9'
};

async function fetchText(url, { timeoutMs = 12000 } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow',
            headers: DEFAULT_HEADERS
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.text();
    } finally {
        clearTimeout(timeoutId);
    }
}

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type']
}));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============== API ENDPOINTS ==============

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        activeTorrents: client.torrents.length,
        activeStreams: activeStreams.size,
        uptime: process.uptime()
    });
});

/**
 * Search for torrents
 * Aggregates results from multiple sources
 */
app.get('/api/search', async (req, res) => {
    const { query, imdbId } = req.query;
    
    if (!query && !imdbId) {
        return res.status(400).json({ error: 'Query or IMDB ID required' });
    }

    try {
        const results = await searchTorrents(query || imdbId);
        res.json({
            status: 'success',
            count: results.length,
            results
        });
    } catch (error) {
        console.error('[Search Error]', error.message);
        res.status(500).json({ 
            error: 'SEARCH_FAILED',
            message: error.message 
        });
    }
});

/**
 * Add a torrent and prepare for streaming
 * Returns stream URL when ready
 */
app.post('/api/stream', async (req, res) => {
    const { magnet, infoHash } = req.body;
    
    if (!magnet && !infoHash) {
        return res.status(400).json({ error: 'Magnet link or info hash required' });
    }

    const magnetURI = magnet || `magnet:?xt=urn:btih:${infoHash}`;

    try {
        const streamInfo = await prepareTorrentStream(magnetURI);
        res.json(streamInfo);
    } catch (error) {
        console.error('[Stream Prepare Error]', error.message);
        res.status(500).json({
            error: error.code || 'STREAM_FAILED',
            message: error.message
        });
    }
});

/**
 * Stream video file with range request support
 * This is what the browser video player consumes
 */
app.get('/api/stream/:infoHash', (req, res) => {
    const { infoHash } = req.params;
    const streamData = activeStreams.get(infoHash);

    if (!streamData || !streamData.videoFile) {
        return res.status(404).json({ 
            error: 'STREAM_NOT_FOUND',
            message: 'Stream not found or not ready. Please call /api/stream first.'
        });
    }

    const { videoFile, torrent } = streamData;
    streamData.lastAccess = Date.now();

    const fileSize = videoFile.length;
    const mimeType = mime.lookup(videoFile.name) || 'video/mp4';

    // Handle range requests for seeking
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        console.log(`[Stream] Range request: ${start}-${end}/${fileSize} (${(chunkSize / 1024 / 1024).toFixed(2)} MB)`);

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache'
        });

        const stream = videoFile.createReadStream({ start, end });
        stream.pipe(res);

        stream.on('error', (err) => {
            console.error('[Stream Error]', err.message);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });
    } else {
        // Full file request
        console.log(`[Stream] Full file request: ${fileSize} bytes`);
        
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
        });

        const stream = videoFile.createReadStream();
        stream.pipe(res);

        stream.on('error', (err) => {
            console.error('[Stream Error]', err.message);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });
    }
});

/**
 * Get stream status (progress, peers, speed)
 */
app.get('/api/stream/:infoHash/status', (req, res) => {
    const { infoHash } = req.params;
    const streamData = activeStreams.get(infoHash);

    if (!streamData) {
        return res.status(404).json({ error: 'STREAM_NOT_FOUND' });
    }

    const { torrent, videoFile } = streamData;

    res.json({
        status: 'STREAMING',
        infoHash: torrent.infoHash,
        name: torrent.name,
        progress: Math.round(torrent.progress * 100),
        downloaded: torrent.downloaded,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        numPeers: torrent.numPeers,
        timeRemaining: torrent.timeRemaining,
        videoFile: videoFile ? {
            name: videoFile.name,
            size: videoFile.length,
            downloaded: videoFile.downloaded,
            progress: Math.round(videoFile.progress * 100)
        } : null
    });
});

/**
 * Stop a stream and cleanup
 */
app.delete('/api/stream/:infoHash', (req, res) => {
    const { infoHash } = req.params;
    
    cleanupStream(infoHash);
    
    res.json({ status: 'ok', message: 'Stream stopped' });
});

// ============== CORE FUNCTIONS ==============

/**
 * Search for torrents from multiple sources
 */
async function searchTorrents(query) {
    const results = [];
    const errors = [];

    // 0. Try Jackett/Prowlarr via Torznab (best reliability when self-hosted)
    try {
        const torznabResults = await searchTorznab(query);
        results.push(...torznabResults);
        console.log(`[Torznab] Found ${torznabResults.length} results`);
    } catch (e) {
        errors.push({ source: 'Torznab', error: e.message });
        console.warn('[Torznab] Search failed:', e.message);
    }

    // 1. Try YTS API (best for movies)
    try {
        const ytsResults = await searchYTS(query);
        results.push(...ytsResults);
        console.log(`[YTS] Found ${ytsResults.length} results`);
    } catch (e) {
        errors.push({ source: 'YTS', error: e.message });
        console.warn('[YTS] Search failed:', e.message);
    }

    // 2. Try 1337x via scraping proxy (if available)
    try {
        const l337xResults = await search1337x(query);
        results.push(...l337xResults);
        console.log(`[1337x] Found ${l337xResults.length} results`);
    } catch (e) {
        errors.push({ source: '1337x', error: e.message });
        console.warn('[1337x] Search failed:', e.message);
    }

    // Remove duplicates based on info hash
    const uniqueResults = [];
    const seenHashes = new Set();
    
    for (const result of results) {
        if (result.infoHash && !seenHashes.has(result.infoHash)) {
            seenHashes.add(result.infoHash);
            uniqueResults.push(result);
        } else if (!result.infoHash) {
            uniqueResults.push(result);
        }
    }

    // Sort by seeders
    uniqueResults.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));

    if (uniqueResults.length === 0 && errors.length > 0) {
        throw new Error('All torrent sources failed: ' + errors.map(e => e.source).join(', '));
    }

    return uniqueResults;
}

async function searchTorznab(query) {
    // Works with Jackett and Prowlarr (both can expose Torznab endpoints).
    // Configure using env vars.
    const q = (query || '').trim();
    if (!q) return [];

    const baseUrl = (process.env.JACKETT_URL || process.env.TORZNAB_URL || '').trim();
    const apiKey = (process.env.JACKETT_API_KEY || process.env.TORZNAB_API_KEY || '').trim();

    if (!baseUrl || !apiKey) {
        return [];
    }

    // If this looks like a Jackett base URL (no /api/v2.0 path), build the full Torznab endpoint.
    // Otherwise assume TORZNAB_URL already points to a Torznab ".../results/torznab/api" endpoint.
    const looksLikeJackettBase = !/\/api\/v2\.0\//i.test(baseUrl) && !/\/torznab\//i.test(baseUrl);
    const endpoint = looksLikeJackettBase
        ? `${baseUrl.replace(/\/$/, '')}/api/v2.0/indexers/all/results/torznab/api`
        : baseUrl;

    const url = new URL(endpoint);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('t', 'search');
    url.searchParams.set('q', q);
    // Optional: let users override category filtering.
    // Example movie categories differ per indexer; leaving unset improves compatibility.
    if (process.env.TORZNAB_CAT) {
        url.searchParams.set('cat', process.env.TORZNAB_CAT);
    }

    const xml = await fetchText(url.toString(), { timeoutMs: 15000 });
    return parseTorznabXml(xml);
}

function parseTorznabXml(xmlText) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: false
    });

    let parsed;
    try {
        parsed = parser.parse(xmlText);
    } catch (e) {
        throw new Error('Invalid Torznab XML response');
    }

    const channel = parsed?.rss?.channel;
    if (!channel) return [];

    const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);

    return items
        .map((item) => {
            const title = (item.title || '').toString().trim();

            // Magnet can appear in various places.
            const enclosureUrl = item.enclosure?.['@_url'];
            const link = item.link;
            const guid = typeof item.guid === 'string' ? item.guid : item.guid?.['#text'];
            const magnet = [enclosureUrl, link, guid].find(v => typeof v === 'string' && v.startsWith('magnet:?')) || null;

            const attrsRaw = item['torznab:attr'] || item.attr || [];
            const attrs = Array.isArray(attrsRaw) ? attrsRaw : [attrsRaw];

            const getAttr = (name) => {
                const found = attrs.find(a => (a?.['@_name'] || a?.name) === name);
                return found?.['@_value'] ?? found?.value;
            };

            const seeders = parseInt(getAttr('seeders') ?? '0', 10) || 0;
            const leechers = parseInt(getAttr('peers') ?? getAttr('leechers') ?? '0', 10) || 0;
            const sizeBytes = parseInt(getAttr('size') ?? '0', 10) || 0;
            const size = sizeBytes > 0 ? `${(sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB` : (item.size || null);

            // Some feeds include infohash
            const infoHash = (getAttr('infohash') || getAttr('infoHash') || '').toString().trim() || null;

            if (!title || !magnet) return null;

            return {
                name: title,
                magnet,
                infoHash: infoHash || undefined,
                seeders,
                leechers,
                size,
                source: 'Torznab'
            };
        })
        .filter(Boolean);
}

/**
 * Search YTS API
 */
async function searchYTS(query) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        // Try multiple YTS mirrors
        const mirrors = [
            'https://yts.mx/api/v2/list_movies.json',
            'https://yts.sb/api/v2/list_movies.json',
            'https://yts.torrentbay.net/api/v2/list_movies.json',
            'https://yts.unblockit.click/api/v2/list_movies.json'
        ];

        for (const baseUrl of mirrors) {
            try {
                const url = `${baseUrl}?query_term=${encodeURIComponent(query)}&limit=20&sort_by=seeds`;
                const res = await fetch(url, { signal: controller.signal });
                
                if (!res.ok) continue;

                const data = await res.json();
                
                if (data?.data?.movies) {
                    return data.data.movies.flatMap(movie => {
                        return (movie.torrents || []).map(torrent => ({
                            name: `${movie.title_long} [${torrent.quality}] [${torrent.type}]`,
                            infoHash: torrent.hash,
                            magnet: buildMagnet(torrent.hash, movie.title_long),
                            size: torrent.size,
                            seeders: torrent.seeds || 0,
                            leechers: torrent.peers || 0,
                            quality: torrent.quality,
                            source: 'YTS'
                        }));
                    });
                }
            } catch (e) {
                // Try next mirror
                continue;
            }
        }

        return [];
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Search 1337x (via proxy or direct if available)
 * This is a fallback when YTS doesn't have results
 */
async function search1337x(query) {
    // 1337x HTML scrape (no public proxy APIs). This may fail if the site is blocked.
    // We try a few mirrors and keep it best-effort.
    const bases = [
        'https://1337x.to',
        'https://1337x.tw',
        'https://1337x.st',
        'https://x1337x.cc'
    ];

    const q = (query || '').trim();
    if (!q) return [];

    const maxCandidates = 12;
    const maxMagnetFetch = 6;
    const results = [];

    for (const base of bases) {
        try {
            // Sort by seeders desc for better reliability
            const searchUrl = `${base}/sort-search/${encodeURIComponent(q)}/seeders/desc/1/`;
            const html = await fetchText(searchUrl, { timeoutMs: 12000 });
            const $ = cheerio.load(html);

            const rows = $('table.table-list tbody tr').toArray();
            if (rows.length === 0) {
                // Some mirrors return different markup; try a looser selector.
                // If still empty, move on to next base.
                continue;
            }

            const candidates = [];
            for (const row of rows.slice(0, maxCandidates)) {
                const $row = $(row);
                const nameAnchor = $row.find('td.name a').last();
                const href = nameAnchor.attr('href') || '';
                const name = nameAnchor.text().trim();
                const seeders = parseInt($row.find('td.seeds').text().trim(), 10) || 0;
                const leechers = parseInt($row.find('td.leeches').text().trim(), 10) || 0;
                const size = $row.find('td.size').text().trim();

                // href examples: /torrent/1234567/Some-Title/
                const match = href.match(/\/torrent\/(\d+)\//);
                const torrentId = match?.[1];
                if (!torrentId || !name) continue;

                candidates.push({ base, torrentId, name, seeders, leechers, size });
            }

            if (candidates.length === 0) continue;

            // Fetch magnets for the top candidates (limited concurrency)
            const top = candidates.slice(0, maxMagnetFetch);
            const magnets = await Promise.all(top.map(async (c) => {
                try {
                    const magnet = await fetch1337xMagnet(c.base, c.torrentId);
                    if (!magnet) return null;
                    return {
                        name: c.name,
                        magnet,
                        seeders: c.seeders,
                        leechers: c.leechers,
                        size: c.size,
                        source: '1337x'
                    };
                } catch {
                    return null;
                }
            }));

            for (const m of magnets) {
                if (m?.magnet) results.push(m);
            }

            // If we got anything from this base, don't keep hammering mirrors.
            if (results.length > 0) break;
        } catch {
            // Try next mirror
            continue;
        }
    }

    // Sort by seeders again (magnet fetch may reorder)
    results.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
    return results;
}

async function fetch1337xMagnet(base, torrentId) {
    const url = `${base}/torrent/${torrentId}/`;
    const html = await fetchText(url, { timeoutMs: 12000 });
    const $ = cheerio.load(html);

    // Magnet link is usually in: a[href^="magnet:?"]
    const magnet = $('a[href^="magnet:?"]').first().attr('href');
    if (magnet && magnet.startsWith('magnet:?')) {
        return magnet;
    }

    // Fallback: search all links
    const any = $('a').toArray().map(a => $(a).attr('href')).find(h => typeof h === 'string' && h.startsWith('magnet:?'));
    return any || null;
}

/**
 * Build magnet link from info hash
 */
function buildMagnet(hash, name) {
    const encodedName = encodeURIComponent(name || 'video');
    const trackerParams = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');
    return `magnet:?xt=urn:btih:${hash}&dn=${encodedName}${trackerParams}`;
}

/**
 * Prepare a torrent for streaming
 */
function prepareTorrentStream(magnetURI) {
    return new Promise((resolve, reject) => {
        // Reuse existing torrent if already added (note: it may not be ready yet)
        const existingTorrent = client.get(magnetURI);
        if (existingTorrent) {
            // If we already prepared a stream for this infoHash, return immediately.
            const existingStream = activeStreams.get(existingTorrent.infoHash);
            if (existingStream?.videoFile) {
                const streamUrl = `http://localhost:${PORT}/api/stream/${existingTorrent.infoHash}`;
                existingStream.lastAccess = Date.now();
                return resolve({
                    status: 'STREAM_READY',
                    streamUrl,
                    infoHash: existingTorrent.infoHash,
                    name: existingTorrent.name,
                    videoFile: existingStream.videoFile.name,
                    size: existingStream.videoFile.length,
                    peers: existingTorrent.numPeers
                });
            }

            // If the torrent exists but is not ready yet, wait for metadata.
            if (!existingTorrent.ready) {
                console.log('[Torrent] Already added, waiting for metadata...');

                const timeoutId = setTimeout(() => {
                    if (!existingTorrent.ready) {
                        destroyTorrentSafe(existingTorrent);
                        reject({
                            code: 'METADATA_TIMEOUT',
                            message: 'Could not fetch torrent metadata. The torrent may have no seeds.'
                        });
                    }
                }, 45000);

                const detachReady = onOnce(existingTorrent, 'ready', () => {
                    clearTimeout(timeoutId);

                    const videoFile = findVideoFile(existingTorrent);
                    if (!videoFile) {
                        destroyTorrentSafe(existingTorrent);
                        return reject({
                            code: 'NO_VIDEO_FILE',
                            message: 'No playable video file found in torrent'
                        });
                    }

                    videoFile.select();
                    activeStreams.set(existingTorrent.infoHash, {
                        torrent: existingTorrent,
                        videoFile,
                        lastAccess: Date.now()
                    });

                    const streamUrl = `http://localhost:${PORT}/api/stream/${existingTorrent.infoHash}`;
                    resolve({
                        status: 'STREAM_READY',
                        streamUrl,
                        infoHash: existingTorrent.infoHash,
                        name: existingTorrent.name,
                        videoFile: videoFile.name,
                        size: videoFile.length,
                        peers: existingTorrent.numPeers
                    });
                });

                const detachError = onOnce(existingTorrent, 'error', (err) => {
                    clearTimeout(timeoutId);
                    reject({
                        code: 'TORRENT_ERROR',
                        message: err?.message || 'Torrent error'
                    });
                });

                // Best-effort: if one triggers, detach the other.
                void detachReady;
                void detachError;

                return;
            }

            // Torrent exists and is ready but stream not prepared yet.
            const videoFile = findVideoFile(existingTorrent);
            if (videoFile) {
                videoFile.select();
                activeStreams.set(existingTorrent.infoHash, {
                    torrent: existingTorrent,
                    videoFile,
                    lastAccess: Date.now()
                });

                const streamUrl = `http://localhost:${PORT}/api/stream/${existingTorrent.infoHash}`;
                return resolve({
                    status: 'STREAM_READY',
                    streamUrl,
                    infoHash: existingTorrent.infoHash,
                    name: existingTorrent.name,
                    videoFile: videoFile.name,
                    size: videoFile.length,
                    peers: existingTorrent.numPeers
                });
            }
        }

        console.log('[Torrent] Adding:', magnetURI.substring(0, 80) + '...');

        // Add trackers to magnet
        const magnetWithTrackers = magnetURI.includes('&tr=') 
            ? magnetURI 
            : magnetURI + TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');

        // Metadata timeout (45 seconds)
        let metadataTimeout = null;

        const torrent = client.add(magnetWithTrackers, {
            announce: TRACKERS,
            maxWebConns: 10
        });

        metadataTimeout = setTimeout(() => {
            if (!torrent.ready) {
                destroyTorrentSafe(torrent);
                reject({
                    code: 'METADATA_TIMEOUT',
                    message: 'Could not fetch torrent metadata. The torrent may have no seeds.'
                });
            }
        }, 45000);

        torrent.on('ready', () => {
            if (metadataTimeout) clearTimeout(metadataTimeout);
            console.log('[Torrent] Ready:', torrent.name);
            if (Array.isArray(torrent.files)) {
                console.log('[Torrent] Files:', torrent.files.map(f => `${f.name} (${(f.length / 1024 / 1024).toFixed(2)} MB)`));
            }

            const videoFile = findVideoFile(torrent);

            if (!videoFile) {
                destroyTorrentSafe(torrent);
                return reject({
                    code: 'NO_VIDEO_FILE',
                    message: 'No playable video file found in torrent'
                });
            }

            // Prioritize the video file
            videoFile.select();
            
            // Store in active streams
            activeStreams.set(torrent.infoHash, {
                torrent,
                videoFile,
                lastAccess: Date.now()
            });

            const streamUrl = `http://localhost:${PORT}/api/stream/${torrent.infoHash}`;

            console.log(`[Stream] Ready: ${streamUrl}`);

            resolve({
                status: 'STREAM_READY',
                streamUrl,
                infoHash: torrent.infoHash,
                name: torrent.name,
                videoFile: videoFile.name,
                size: videoFile.length,
                peers: torrent.numPeers
            });
        });

        torrent.on('warning', (warn) => {
            console.warn('[Torrent Warning]', warn);
        });

        torrent.on('error', (err) => {
            if (metadataTimeout) clearTimeout(metadataTimeout);
            console.error('[Torrent Error]', err.message);
            reject({
                code: 'TORRENT_ERROR',
                message: err.message
            });
        });

        // Monitor peer count
        torrent.on('noPeers', (announceType) => {
            console.warn(`[Torrent] No peers from ${announceType}`);
        });

        // Log download progress
        let lastLoggedProgress = 0;
        torrent.on('download', () => {
            const progress = Math.round(torrent.progress * 100);
            if (progress >= lastLoggedProgress + 5) {
                lastLoggedProgress = progress;
                console.log(`[Download] ${progress}% - ${(torrent.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s - ${torrent.numPeers} peers`);
            }
        });
    });
}

/**
 * Find the largest video file in a torrent
 */
function findVideoFile(torrent) {
    if (!torrent || !Array.isArray(torrent.files) || torrent.files.length === 0) {
        return null;
    }

    const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv'];
    
    // First, look for files with video extensions
    let videoFiles = torrent.files.filter(file => 
        videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
    );

    // Sort by size (largest first)
    videoFiles.sort((a, b) => b.length - a.length);

    if (videoFiles.length > 0) {
        return videoFiles[0];
    }

    // Fallback: return largest file
    const sortedFiles = [...torrent.files].sort((a, b) => b.length - a.length);
    return sortedFiles[0] || null;
}

/**
 * Cleanup a stream
 */
function cleanupStream(infoHash) {
    const streamData = activeStreams.get(infoHash);
    
    if (streamData) {
        console.log(`[Cleanup] Removing stream: ${infoHash}`);
        
        if (streamData.torrent) {
            destroyTorrentSafe(streamData.torrent);
        }
        
        activeStreams.delete(infoHash);
    }
}

/**
 * Periodic cleanup of inactive streams
 */
function runCleanup() {
    const now = Date.now();
    
    for (const [infoHash, streamData] of activeStreams.entries()) {
        if (now - streamData.lastAccess > INACTIVE_TIMEOUT) {
            console.log(`[Cleanup] Stream inactive for ${INACTIVE_TIMEOUT / 60000} minutes: ${infoHash}`);
            cleanupStream(infoHash);
        }
    }
}

setInterval(runCleanup, CLEANUP_INTERVAL);

// ============== START SERVER ==============

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       CinemaHalal Streaming Server                       ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Server running on: http://localhost:${PORT}               ║`);
    console.log('║                                                          ║');
    console.log('║  API Endpoints:                                          ║');
    console.log('║    GET  /api/health          - Server health check       ║');
    console.log('║    GET  /api/search?query=X  - Search torrents           ║');
    console.log('║    POST /api/stream          - Prepare stream            ║');
    console.log('║    GET  /api/stream/:hash    - Stream video              ║');
    console.log('║    GET  /api/stream/:hash/status - Stream status         ║');
    console.log('║    DELETE /api/stream/:hash  - Stop stream               ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    client.destroy(() => {
        console.log('[Server] WebTorrent client destroyed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n[Server] Received SIGTERM...');
    client.destroy(() => {
        process.exit(0);
    });
});
