// Polyfill File for undici/cheerio in Node 18 (Electron 28)
try {
    const { File } = require('buffer');
    if (!global.File) {
        global.File = File;
    }
} catch (e) {
    console.warn('Could not polyfill File API');
}

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const cheerio = require('cheerio');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // Allow loading local resources if needed
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'img/icon.png') // Placeholder
    });

    mainWindow.loadFile('index.html');

    // --- AdBlock & Popup Blocker ---

    // 1. Block all new windows (Popups)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Allow only specific trusted domains if needed, otherwise block everything
        // For a streaming app, we usually want to keep the user in the main window
        console.log('[AdBlock] Blocked popup:', url);
        return { action: 'deny' };
    });

    // 2. Block Ad Requests
    const adFilter = {
        urls: [
            "*://*.doubleclick.net/*",
            "*://*.googleadservices.com/*",
            "*://*.googlesyndication.com/*",
            "*://*.moatads.com/*",
            "*://*.adnxs.com/*",
            "*://*.adsystem.com/*",
            "*://*.adservice.com/*",
            "*://*.101com.com/*",
            "*://*.ad-delivery.net/*",
            "*://*.ad.gt/*",
            "*://*.popads.net/*",
            "*://*.popcash.net/*",
            "*://*.propellerads.com/*",
            "*://*.adsterra.com/*",
            "*://*.mc.yandex.ru/*",
            "*://*.gemini.yahoo.com/*",
            "*://*.bebi.com/*",
            "*://*.juicyads.com/*",
            "*://*.exoclick.com/*",
            "*://*.trafficjunky.net/*",
            "*://*.onclickads.net/*",
            "*://*.bidvertiser.com/*",
            "*://*.infolinks.com/*",
            "*://*.revenuehits.com/*",
            "*://*.clickadu.com/*",
            "*://*.a-ads.com/*",
            "*://*.adbuffs.com/*",
            "*://*.hilltopads.com/*",
            "*://*.syndication.exoclick.com/*",
            "*://*.tsyndicate.com/*",
            "*://*.wix.com/*" // Sometimes used for landing page ads
        ]
    };

    mainWindow.webContents.session.webRequest.onBeforeRequest(adFilter, (details, callback) => {
        // console.log('[AdBlock] Blocked ad request:', details.url);
        callback({ cancel: true });
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function startServer() {
    const serverPath = path.join(__dirname, 'server', 'server.js');
    console.log('Starting server from:', serverPath);
    
    // Fork the server process
    serverProcess = fork(serverPath, [], {
        env: { ...process.env, PORT: 3001 },
        stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[Server]: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error]: ${data}`);
    });
}

app.whenReady().then(() => {
    startServer();
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

// --- IPC Handlers for "Superpowers" ---

// 1337x Scraper using a hidden window to bypass Cloudflare
ipcMain.handle('search-1337x', async (event, query) => {
    const bases = [
        'https://1337x.to',
        'https://1337x.st',
        'https://x1337x.cc',
        'https://1337x.ws',
        'https://1337x.eu',
        'https://1337x.se',
        'https://1337x.is'
    ];

    for (const base of bases) {
        try {
            console.log(`[Electron] Scraping ${base} for "${query}"...`);
            const searchUrl = `${base}/sort-search/${encodeURIComponent(query)}/seeders/desc/1/`;
            
            const html = await fetchWithHiddenWindow(searchUrl);
            if (!html) continue;

            const $ = cheerio.load(html);
            const rows = $('table.table-list tbody tr').toArray();
            
            if (rows.length === 0) {
                console.log(`[Electron] No results found on ${base}`);
                continue;
            }

            const results = [];
            const maxItems = 5; // Reduce to 5 to speed up magnet fetching

            for (const row of rows.slice(0, maxItems)) {
                const $row = $(row);
                const nameAnchor = $row.find('td.name a').last();
                const href = nameAnchor.attr('href');
                const name = nameAnchor.text().trim();
                const seeders = parseInt($row.find('td.seeds').text().trim(), 10) || 0;
                const leechers = parseInt($row.find('td.leeches').text().trim(), 10) || 0;
                const size = $row.find('td.size').text().trim();

                if (!name || !href) continue;

                // Now fetch details for magnet
                const detailUrl = base + href;
                const detailHtml = await fetchWithHiddenWindow(detailUrl);
                if (!detailHtml) continue;

                const $d = cheerio.load(detailHtml);
                
                // Try multiple selectors for magnet link
                let magnet = $d('a[href^="magnet:?"]').first().attr('href');
                
                // Fallback: look for any link containing magnet:?
                if (!magnet) {
                    $d('a').each((i, el) => {
                        const h = $d(el).attr('href');
                        if (h && h.includes('magnet:?')) {
                            magnet = h;
                            return false;
                        }
                    });
                }

                if (magnet) {
                    results.push({
                        name,
                        magnet,
                        seeders,
                        leechers,
                        size,
                        source: '1337x (App)'
                    });
                }
            }

            if (results.length > 0) return results;

        } catch (err) {
            console.error(`[Electron] Error scraping ${base}:`, err);
        }
    }

    return [];
});

async function fetchWithHiddenWindow(url) {
    return new Promise((resolve) => {
        const win = new BrowserWindow({
            show: false,
            width: 800,
            height: 600,
            webPreferences: {
                offscreen: true,
                images: false // Disable images to speed up loading
            }
        });

        let resolved = false;

        // Hard Timeout
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log('[Electron] Timeout loading:', url);
                win.destroy();
                resolve(null);
            }
        }, 20000); // 20s timeout

        win.loadURL(url).catch(() => {
            if (!resolved) {
                resolved = true;
                win.destroy();
                resolve(null);
            }
        });

        win.webContents.on('did-finish-load', async () => {
            if (resolved) return;
            
            // Polling loop to check for Cloudflare bypass
            const checkCloudflare = async (attempts = 0) => {
                if (resolved) return;
                
                if (attempts > 10) { // Give up after ~10-15 seconds of checking
                    console.log('[Electron] Failed to bypass Cloudflare');
                    resolved = true;
                    clearTimeout(timeout);
                    win.destroy();
                    resolve(null);
                    return;
                }

                try {
                    const title = win.getTitle();
                    const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
                    
                    // Check for Cloudflare indicators
                    const isCloudflare = title.includes('Just a moment') || 
                                       title.includes('Cloudflare') || 
                                       html.includes('challenge-form');

                    if (isCloudflare) {
                        console.log(`[Electron] Cloudflare detected (Attempt ${attempts + 1})...`);
                        setTimeout(() => checkCloudflare(attempts + 1), 1500);
                        return;
                    }

                    // Success!
                    resolved = true;
                    clearTimeout(timeout);
                    win.destroy();
                    resolve(html);

                } catch (e) {
                    // Window might be destroyed
                    if (!resolved) {
                        resolved = true;
                        resolve(null);
                    }
                }
            };

            checkCloudflare();
        });
    });
}
