# CinemaHalal Media Bridge
*Distributed Media Relay & Aggregation Service*

The Media Bridge is a high-performance Node.js service designed to facilitate seamless media delivery between distributed networks and modern web interfaces. It serves as a sophisticated relay that overcomes client-side networking limitations.

## 🚀 Purpose
In distributed media environments, web browsers face significant constraints:
- ❌ **Network Isolation**: Browsers lack support for standard distributed protocols (UDP/DHT).
- ❌ **Protocol Mismatch**: Most public media swarms do not utilize WebRTC-compatible signaling.
- ❌ **Discovery Barriers**: Client-side peer discovery is often restricted by sandbox security.

This service bridges these gaps by:
- ✅ **Full Protocol Support**: Native integration with DHT, UDP, TCP, and HTTP trackers.
- ✅ **Real-time Transcoding/Relay**: Streams content via standard HTTP range requests for instant playback and seeking.
- ✅ **Universal Compatibility**: Enables discovery of diverse media nodes across the peer network.
- ✅ **Efficient Lifecycle**: Automated resource management and inactive stream cleanup.

## 🛠️ Setup
```bash
npm install
npm start
```

## 📡 API Reference
The service exposes a secure REST API for media management:

| Endpoint | Method | Role |
|----------|--------|------|
| `/api/health` | GET | Connection diagnostics |
| `/api/search` | GET | Discover distributed content |
| `/api/stream` | POST | Initialize media relay |
| `/api/stream/:id` | GET | Binary media delivery (Range-support) |
| `/api/stream/:id/status`| GET | Real-time performance metrics |

## 🏗️ Deployment
For high-availability environments, utilize a process manager like PM2:
```bash
npm install -g pm2
pm2 start server.js --name media-bridge
```

---
*This service is intended for bridging personal media collections and public domain data.*
