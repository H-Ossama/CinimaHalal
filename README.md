<p align="center">
  <img src="img\icon.png" width="150" alt="CinemaHalal Logo">
</p>

<h1 align="center">CinemaHalal</h1>


---

# CinemaHalal
*Stream Responsibly, Watch Together.*

CinemaHalal is a professional-grade personal media center and content aggregator designed with family values at its core. It combines a state-of-the-art interface with advanced content filtering to ensure a safe and enjoyable viewing experience for all ages.

## 🌟 Key Features
- **👨‍👩‍👧‍👦 Family Mode**: Intelligent content filtering that automatically hides explicit themes, horror, and thriller categories.
- **�️ Advanced Safety**: Integrated profanity filters for subtitles and metadata sanitization.
- **🎨 Premium UI/UX**: A modern, responsive interface inspired by top-tier streaming platforms, optimized for both desktop and mobile.
- **📊 TMDB Integration**: Seamlessly browse millions of titles with rich metadata, cast information, and recommendations.
- **⚡ Hybrid Streaming**: High-performance media delivery using a dedicated backend relay and browser-based distributed protocols.
- **🔖 Personal Library**: Cloud-synced (local storage) watchlist to keep track of your favorite content.

## 📸 Screenshots
<p align="center">
  <img src="screenshots/hero.png" width="491%" title="Home Dashboard" />
</p>
<p align="center">
  <img src="screenshots/watchlist.png" width="45%" title="Personal Watchlist" />
  <img src="screenshots/trending.png" width="45%" title="Discovery Section" />
</p>
<p align="center">
  <img src="screenshots/movies.png" width="45%" title="Movie Catalog" />
  <img src="screenshots/series.png" width="45%" title="TV Series Hub" />
</p>
<p align="center">
  <img src="screenshots/details.png" width="45%" title="Content Details" />
  <img src="screenshots/settings.png" width="45%" title="Safety Settings" />
</p>

  


## 🚀 Architecture
CinemaHalal utilizes a **Distributed Media Protocol (DMP)** architecture to provide reliable access to public media repositories while respecting network limitations.

1. **Relay Server**: Optimized Node.js instance for high-bandwidth media streaming.
2. **P2P Client**: Integrated WebTorrent engine for direct browser-to-browser media sharing.
3. **External API Connectors**: Fallback providers for diverse media availability.

## 🛠️ Installation & Setup

### 1. Prerequisite: Node.js
Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) installed on your system.

### 2. Install Media Bridge
```bash
./install-server.bat
```

### 3. Launch Services
```bash
./start-server.bat
```

### 4. Access the Dashboard
Simply open `index.html` in any modern web browser.

## 📂 Project Structure
- **/js/app.js**: The core engine managing state, TMDB integration, and player logic.
- **/server/**: High-performance backend bridge for media streaming.
- **/css/styles.css**: Custom design system built on top of Tailwind CSS.
- **index.html**: Main discovery dashboard.

---
*Disclaimer: CinemaHalal is a technology demonstration project. Users are responsible for ensuring they have the legal right to access the media they stream.*
