
# 1337x Scraping Solutions

Due to Cloudflare protection on 1337x.to, simple scraping methods often fail. We have two solutions:

## Option 1: Interactive Scraper (Recommended for now)
This script opens a **visible** Chrome window. If Cloudflare asks for a CAPTCHA, you can solve it manually, and the script will continue.

**Usage:**
```bash
node interactive-scraper.js "your search query"
```

## Option 2: FlareSolverr (Advanced)
FlareSolverr is a proxy server that automatically solves Cloudflare challenges. It requires Docker.

**Setup:**
1. Install Docker Desktop.
2. Run the FlareSolverr container:
   ```bash
   docker run -d --name=flaresolverr -p 8191:8191 -e LOG_LEVEL=info ghcr.io/flaresolverr/flaresolverr:latest
   ```
3. Once running, use the client script:
   ```bash
   node flaresolverr-client.js "your search query"
   ```
