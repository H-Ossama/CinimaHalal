
/**
 * FlareSolverr Client
 * 
 * Requires FlareSolverr to be running.
 * Default URL: http://localhost:8191
 * 
 * Setup:
 * 1. Install Docker
 * 2. Run: docker run -d --name=flaresolverr -p 8191:8191 -e LOG_LEVEL=info ghcr.io/flaresolverr/flaresolverr:latest
 */

import * as cheerio from 'cheerio';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';
const BASE_URL = 'https://1337x.to';

async function flareRequest(url, method = 'GET', postData = null) {
    const body = {
        cmd: `request.${method.toLowerCase()}`,
        url: url,
        maxTimeout: 60000,
    };

    if (postData) {
        body.postData = postData;
    }

    try {
        const response = await fetch(FLARESOLVERR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`FlareSolverr error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.status !== 'ok') {
            throw new Error(`FlareSolverr failed: ${data.message}`);
        }

        return data.solution.response; // The HTML
    } catch (error) {
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            throw new Error('Could not connect to FlareSolverr. Is it running on port 8191?');
        }
        throw error;
    }
}

async function scrapeWithFlareSolverr(query) {
    console.log(`[FlareSolverr] Searching for: ${query}`);

    try {
        // 1. Search
        const searchUrl = `${BASE_URL}/sort-search/${encodeURIComponent(query)}/seeders/desc/1/`;
        console.log(`[FlareSolverr] Fetching ${searchUrl}...`);
        
        const html = await flareRequest(searchUrl);
        const $ = cheerio.load(html);

        const results = [];
        const rows = $('table.table-list tbody tr').slice(0, 10);

        console.log(`[FlareSolverr] Found ${rows.length} rows.`);

        rows.each((i, row) => {
            const $row = $(row);
            const nameLink = $row.find('td.name a').not('.icon');
            const href = nameLink.attr('href');
            const name = nameLink.text().trim();
            const seeders = parseInt($row.find('td.seeds').text().trim() || '0');
            const leechers = parseInt($row.find('td.leeches').text().trim() || '0');
            const size = $row.find('td.size').contents().first().text().trim();

            if (name && href) {
                results.push({ name, href, seeders, leechers, size });
            }
        });

        // 2. Get Magnets
        for (const result of results) {
            const detailUrl = BASE_URL + result.href;
            console.log(`[FlareSolverr] Fetching details: ${result.name}`);
            
            try {
                const detailHtml = await flareRequest(detailUrl);
                const $d = cheerio.load(detailHtml);
                const magnet = $d('a[href^="magnet:?"]').attr('href');

                if (magnet) {
                    result.magnet = magnet;
                    console.log(' -> Magnet found');
                }
            } catch (e) {
                console.error(` -> Error: ${e.message}`);
            }
        }

        const finalResults = results.filter(r => r.magnet);
        console.log(JSON.stringify(finalResults, null, 2));
        return finalResults;

    } catch (error) {
        console.error('[FlareSolverr] Error:', error.message);
    }
}

// Run if called directly
const query = process.argv[2] || 'avatar';
scrapeWithFlareSolverr(query);
