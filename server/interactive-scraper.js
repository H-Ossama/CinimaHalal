
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://1337x.to';

async function scrapeInteractive(query) {
    console.log(`[Interactive Scraper] Launching visible browser for: ${query}`);
    console.log('[Interactive Scraper] Please solve any CAPTCHAs manually in the browser window if they appear.');

    const browser = await puppeteer.launch({
        headless: false, // VISIBLE BROWSER
        defaultViewport: null, // Use full window size
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // 1. Go to search page
        const searchUrl = `${BASE_URL}/sort-search/${encodeURIComponent(query)}/seeders/desc/1/`;
        console.log(`[Interactive Scraper] Navigating to ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 2. Wait for results or user interaction
        console.log('[Interactive Scraper] Waiting for results table...');
        
        // Wait up to 2 minutes for the user to solve Cloudflare
        try {
            await page.waitForSelector('table.table-list', { timeout: 120000 });
        } catch (e) {
            console.error('[Interactive Scraper] Timeout waiting for table. Did you solve the CAPTCHA?');
            throw e;
        }

        console.log('[Interactive Scraper] Table found! Extracting results...');

        // 3. Extract search results
        const results = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table.table-list tbody tr'));
            return rows.slice(0, 10).map(row => {
                const nameLink = row.querySelector('td.name a:not(.icon)');
                const seeds = row.querySelector('td.seeds')?.textContent?.trim();
                const leeches = row.querySelector('td.leeches')?.textContent?.trim();
                const size = row.querySelector('td.size')?.textContent?.replace(row.querySelector('td.size span')?.textContent || '', '').trim();
                
                return {
                    name: nameLink?.textContent?.trim(),
                    href: nameLink?.getAttribute('href'),
                    seeders: parseInt(seeds || '0'),
                    leechers: parseInt(leeches || '0'),
                    size: size
                };
            }).filter(r => r.name && r.href);
        });

        console.log(`[Interactive Scraper] Found ${results.length} candidates.`);

        // 4. Get Magnet links (visiting each page)
        for (const result of results) {
            if (!result.href) continue;
            
            console.log(`[Interactive Scraper] Fetching magnet for: ${result.name}`);
            const detailUrl = BASE_URL + result.href;
            
            try {
                await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });
                
                // Wait for magnet
                try {
                    await page.waitForSelector('a[href^="magnet:?"]', { timeout: 5000 });
                } catch {}

                const magnet = await page.evaluate(() => {
                    return document.querySelector('a[href^="magnet:?"]')?.getAttribute('href');
                });

                if (magnet) {
                    result.magnet = magnet;
                    console.log(' -> Magnet found');
                } else {
                    console.log(' -> No magnet found');
                }
                
            } catch (e) {
                console.error(` -> Error: ${e.message}`);
            }
        }

        const finalResults = results.filter(r => r.magnet);
        console.log('\n=== FINAL RESULTS ===');
        console.log(JSON.stringify(finalResults, null, 2));
        return finalResults;

    } catch (error) {
        console.error('[Interactive Scraper] Error:', error.message);
    } finally {
        console.log('[Interactive Scraper] Closing browser...');
        await browser.close();
    }
}

// Run if called directly
const query = process.argv[2] || 'avatar';
scrapeInteractive(query);
