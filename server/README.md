# CinemaHalal Streaming Server

A Node.js backend that provides reliable torrent streaming by bypassing browser WebTorrent limitations.

## Why This Exists

Browser-based WebTorrent has critical limitations:
- ❌ **DHT doesn't work** - Browsers can't use UDP sockets
- ❌ **Most torrents lack WebRTC trackers** - Only a few torrents support `wss://` trackers
- ❌ **Metadata timeout** - Without peers, the browser can't get torrent metadata
- ❌ **Unreliable peer discovery** - Very few WebRTC-compatible peers exist

This server solves all these problems by:
- ✅ Running Node.js with **full DHT/UDP support**
- ✅ Connecting to **any tracker type** (UDP, HTTP, WebSocket)
- ✅ Streaming to browser via **standard HTTP** (no WebRTC needed)
- ✅ Supporting **range requests** for seeking
- ✅ **Auto-cleanup** of inactive streams

## Installation

```bash
cd server
npm install
```

## Usage

```bash
# Start the server
npm start

# Server runs on http://localhost:3001
```

## API Reference

### Health Check
```
GET /api/health
```

### Search Torrents
```
GET /api/search?query=movie+name
GET /api/search?imdbId=tt1234567
```

### Prepare Stream
```
POST /api/stream
Content-Type: application/json

{
  "magnet": "magnet:?xt=urn:btih:..."
}
// OR
{
  "infoHash": "abc123..."
}
```

Response:
```json
{
  "status": "STREAM_READY",
  "streamUrl": "http://localhost:3001/api/stream/abc123",
  "infoHash": "abc123...",
  "name": "Movie Name",
  "videoFile": "movie.mp4",
  "size": 1234567890
}
```

### Stream Video
```
GET /api/stream/:infoHash
```
Returns video with range request support for seeking.

### Stream Status
```
GET /api/stream/:infoHash/status
```

### Stop Stream
```
DELETE /api/stream/:infoHash
```

## Error Codes

| Code | Description |
|------|-------------|
| `METADATA_TIMEOUT` | Could not fetch torrent metadata (no seeds) |
| `NO_VIDEO_FILE` | Torrent doesn't contain a playable video |
| `NO_SEEDS` | No peers available to download from |
| `STREAM_FAILED` | General streaming error |
| `SEARCH_FAILED` | Torrent search failed |

## Architecture

```
┌─────────────────┐     HTTP Range     ┌───────────────────┐
│   Browser       │◄──────────────────►│  Streaming Server │
│   Video Player  │    /api/stream     │  (Node.js)        │
└─────────────────┘                    └─────────┬─────────┘
                                                 │
                                                 │ DHT + UDP/TCP
                                                 │ Trackers
                                                 ▼
                                       ┌─────────────────────┐
                                       │   BitTorrent        │
                                       │   Swarm             │
                                       └─────────────────────┘
```

## Production Deployment

For production:

1. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start server.js --name cinemahalal-server
```

2. Configure reverse proxy (nginx):
```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
}
```

3. Set environment variables:
```bash
PORT=3001
NODE_ENV=production
```
