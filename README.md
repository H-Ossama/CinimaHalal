# CinemaHalal

A family-friendly movie and TV streaming application with content filtering and reliable torrent streaming.

## Features

- 🎬 Browse movies and TV shows from TMDB
- 👨‍👩‍👧‍👦 Family Mode with content filtering
- 🔒 Profanity filtering in subtitles
- 📺 Multiple streaming sources
- 💾 Watchlist with local storage
- 🌐 Real subtitles from OpenSubtitles.com

## Streaming Architecture

### Reliable Torrent Streaming

CinemaHalal uses a **hybrid streaming architecture** to ensure reliable playback:

1. **Backend Streaming Server** (Recommended) - Node.js server that bypasses browser limitations
2. **Browser WebTorrent** (Fallback) - Direct browser streaming via WebRTC

### Why We Need a Backend Server

Browser-based WebTorrent has critical limitations:
- ❌ DHT doesn't work (browsers can't use UDP)
- ❌ Most torrents lack WebRTC trackers
- ❌ Metadata timeout is common
- ❌ Very few WebRTC-compatible peers

The backend server solves all these problems by using Node.js with full network access.

## Quick Start

### 1. Install the Streaming Server

```bash
# Run the installer
install-server.bat

# Or manually:
cd server
npm install
```

### 2. Start the Server

```bash
# Run the start script
start-server.bat

# Or manually:
cd server
npm start
```

The server runs on `http://localhost:3001`

### 3. Open the Website

Open `index.html` in your browser or use a local server like Live Server.

## How It Works

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

When you click play:
1. Frontend checks if backend server is available
2. If yes → Uses backend for reliable streaming
3. If no → Falls back to browser WebTorrent (less reliable)
4. If both fail → Switch to embedded servers (VidSrc, etc.)

## API Endpoints (Backend Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/search` | GET | Search torrents |
| `/api/stream` | POST | Prepare stream |
| `/api/stream/:hash` | GET | Stream video |
| `/api/stream/:hash/status` | GET | Get status |
| `/api/stream/:hash` | DELETE | Stop stream |

## Error Handling

The app handles these error states gracefully:
- `METADATA_TIMEOUT` - No torrent metadata (suggests switching servers)
- `NO_SEEDS` - No peers available
- `NO_VIDEO_FILE` - Torrent has no video
- `STREAM_FAILED` - General streaming error

## Folder Structure

```
cinima/
├── index.html          # Main page
├── movies.html         # Movies catalog
├── series.html         # TV series catalog
├── watchlist.html      # User watchlist
├── search.html         # Search results
├── install-server.bat  # Server installer
├── start-server.bat    # Server launcher
├── css/
│   └── styles.css      # Styles
├── js/
│   └── app.js          # Frontend logic
└── server/
    ├── package.json    # Node.js dependencies
    ├── server.js       # Streaming server
    └── README.md       # Server documentation
```

## Requirements

- **Browser**: Chrome, Firefox, Edge, Safari (modern versions)
- **Node.js**: v18+ (for streaming server)
- **Network**: Unrestricted access to torrent trackers (some ISPs block them)

## Troubleshooting

### "Metadata timeout" error
- Start the backend server (`start-server.bat`)
- Or switch to VidSrc/MultiEmbed server

### Video doesn't play
- Check if the backend server is running
- Try a different quality option
- Switch to an embedded server

### Slow streaming
- The backend server provides faster streaming
- Choose torrents with more seeders (shown in quality menu)

## License

MIT

CinemaHalal is a family-friendly streaming application that allows users to browse and watch movies and TV series with content filtering capabilities.

## Features

- **Family Mode**: Filters out adult content, horror, and thriller genres.
- **Streaming**: Multiple streaming sources including P2P (WebTorrent) and embedded players.
- **Watchlist**: Keep track of movies and series you want to watch.
- **Search**: Find movies and TV shows easily.
- **Responsive Design**: Works on desktop and mobile devices.

## Project Structure

```
/
├── css/
│   └── styles.css       # Application styles
├── js/
│   └── app.js           # Application logic
├── index.html           # Home page
├── movies.html          # Movies browsing page
├── series.html          # TV Series browsing page
├── watchlist.html       # User watchlist page
└── README.md            # Project documentation
```

## Setup

1. Clone the repository.
2. Open `index.html` in your browser.
3. No build step required (vanilla HTML/CSS/JS).

## Technologies

- HTML5
- CSS3 (Tailwind CSS via CDN + Custom CSS)
- JavaScript (ES6+)
- TMDB API (The Movie Database)
- WebTorrent (for P2P streaming)
