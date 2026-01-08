// CinemaHalal - Full Featured Movie & Series Streaming App
// =========================================================

// TMDB API Configuration
const TMDB_API_KEY = 'e4381dfe7bcdf6a96d5cee417094fd41';
const TMDB_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlNDM4MWRmZTdiY2RmNmE5NmQ1Y2VlNDE3MDk0ZmQ0MSIsIm5iZiI6MTc2NzMxMTI2OS45MDcsInN1YiI6IjY5NTcwN2E1MTUxNzAxYzVhNzdjNzA1NiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.OnPtnl9168jkKGVSj14r1SvX8di25lQ01oy5-y4-KII';
const TMDB_API_URLS = ['https://api.themoviedb.org/3', 'https://api.tmdb.org/3'];
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';

// Backend Streaming Server Configuration
// This server handles torrent streaming reliably (bypasses browser WebTorrent limits)
const STREAMING_SERVER_URL = 'http://localhost:3001';
let streamingServerAvailable = false;

// Check if backend server is running
async function checkStreamingServer() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${STREAMING_SERVER_URL}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        streamingServerAvailable = res.ok;
        console.log(`[StreamingServer] ${streamingServerAvailable ? 'Available' : 'Not available'}`);
    } catch (e) {
        streamingServerAvailable = false;
        console.log('[StreamingServer] Not running - will use browser WebTorrent with fallback');
    }
}

// Call on app init
checkStreamingServer();

// Global Image Error Handler (Redundancy)
window.handleImageFallback = function (img) {
    const currentSrc = img.src;

    // 1. Try Backup Mirror (image.tmdb.org -> images.tmdb.org)
    if (currentSrc.includes('image.tmdb.org')) {
        console.warn('Primary image source failed, trying backup...');
        img.src = currentSrc.replace('image.tmdb.org', 'images.tmdb.org');
        return;
    }

    // 2. Fallback to Placeholder
    // Determine size based on URL pattern
    let width = 300;
    let height = 450;

    if (currentSrc.includes('/w342')) { width = 342; height = 513; }
    else if (currentSrc.includes('/w500')) { width = 500; height = 750; }
    else if (currentSrc.includes('/w185')) { width = 185; height = 278; }
    else if (currentSrc.includes('/w92')) { width = 92; height = 138; }
    else if (currentSrc.includes('/original') || currentSrc.includes('/w780')) { width = 780; height = 440; }

    const placeholder = `https://placehold.co/${width}x${height}/1f2937/6b7280?text=No+Image`;

    if (img.src !== placeholder) {
        img.src = placeholder;
        img.onerror = null; // Stop infinite loops
    }
};

// WebTorrent Client
let wtClient = null;

// Streaming Sources with subtitle support
const STREAM_SOURCES = {
    webtorrent: {
        name: 'CinimaHalal Server',
        icon: 'fa-shield-alt',
        hasOwnPlayer: false, // Uses custom player
        isP2P: true
    },
    vidsrc: {
        name: 'VidSrc',
        movie: (id, sub) => `https://vidsrc.xyz/embed/movie/${id}`,
        tv: (id, s, e, sub) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`
    },
    vidsrc2: {
        name: 'VidSrc Pro',
        movie: (id, sub) => `https://vidsrc.to/embed/movie/${id}`,
        tv: (id, s, e, sub) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
    },
    embed: {
        name: '2Embed',
        movie: (id, sub) => `https://www.2embed.cc/embed/${id}`,
        tv: (id, s, e, sub) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
    },
    multiembed: {
        name: 'MultiEmbed',
        movie: (id, sub) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
        tv: (id, s, e, sub) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`
    },
    smashystream: {
        name: 'SmashyStream',
        movie: (id, sub) => `https://player.smashy.stream/movie/${id}`,
        tv: (id, s, e, sub) => `https://player.smashy.stream/tv/${id}?s=${s}&e=${e}`
    },
    moviesapi: {
        name: 'MoviesAPI',
        movie: (id, sub) => `https://moviesapi.club/movie/${id}`,
        tv: (id, s, e, sub) => `https://moviesapi.club/tv/${id}/${s}/${e}`
    }
};

// State Management
const state = {
    familyMode: JSON.parse(localStorage.getItem('familyMode') ?? 'true'),
    watchlist: JSON.parse(localStorage.getItem('cinemahalal_watchlist')) || [],
    settings: JSON.parse(localStorage.getItem('cinemahalal_settings')) || {
        defaultServer: 'webtorrent',
        defaultSubtitle: 'en'
    },
    heroItems: [],
    currentHeroIndex: 0,
    currentMovie: null,
    currentMediaType: 'movie',
    currentSeason: 1,
    currentEpisode: 1,
    currentSource: 'vidsrc',
    tvShowDetails: null,
    currentStreamInfoHash: null, // Backend stream identifier
    availableTorrents: [], // For quality selection
    activeSettingsTab: 'general',
    // Pagination
    moviesPage: 1,
    seriesPage: 1,
    movieFilters: { category: 'popular', genre: '', year: '' },
    seriesFilters: { category: 'popular', genre: '' },
    isLoadingMore: false
};

// Player UI state (used by custom controls + filter logic)
const playerState = {
    controlsTimeout: null,
    isMuted: false
};

// Blocked genres for Family Mode
const BLOCKED_GENRE_IDS = [27, 53]; // Horror, Thriller

// Genre name mapping
const GENRE_NAMES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure',
    10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
    10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

// ============== INITIALIZATION ==============

document.addEventListener('DOMContentLoaded', () => {
    console.log('CinemaHalal initializing...');
    initializeApp();
});

async function initializeApp() {
    loadSettings();
    updateFamilyModeUI();
    showLoading(true);

    // Ensure player is hidden on load
    const playerModal = document.getElementById('playerModal');
    const detailModal = document.getElementById('detailModal');
    if (playerModal) {
        playerModal.classList.add('hidden');
        playerModal.style.display = 'none';
    }
    if (detailModal) {
        detailModal.classList.add('hidden');
        detailModal.style.display = 'none';
    }
    document.body.style.overflow = '';

    try {
        // Determine current page based on URL
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';

        console.log('Current page:', page);

        // Force correct section visibility based on page
        const homeSection = document.getElementById('homeSection');
        const moviesSection = document.getElementById('moviesSection');
        const seriesSection = document.getElementById('seriesSection');
        const watchlistSection = document.getElementById('watchlistSection');
        const searchSection = document.getElementById('searchSection');

        // Reset all to hidden first
        if (homeSection) homeSection.classList.add('hidden');
        if (moviesSection) moviesSection.classList.add('hidden');
        if (seriesSection) seriesSection.classList.add('hidden');
        if (watchlistSection) watchlistSection.classList.add('hidden');
        if (searchSection) searchSection.classList.add('hidden');

        // Routing Logic
        if (page.includes('movies.html')) {
            if (moviesSection) moviesSection.classList.remove('hidden');
            await loadMoviesPage(1, false);
        } else if (page.includes('series.html')) {
            if (seriesSection) seriesSection.classList.remove('hidden');
            await loadSeriesPage(1, false);
        } else if (page.includes('watchlist.html')) {
            if (watchlistSection) watchlistSection.classList.remove('hidden');
            renderWatchlist();
        } else if (page.includes('search.html')) {
            if (searchSection) searchSection.classList.remove('hidden');
            await loadSearchPage();
        } else {
            // Default to Home (index.html, root, or unknown)
            if (homeSection) homeSection.classList.remove('hidden');
            // Load all home sections in parallel
            await Promise.all([
                loadHeroContent(),
                loadHomeSection('trending/movie/week', 'trendingMovies', 'movie'),
                loadHomeSection('movie/now_playing', 'latestMovies', 'movie'),
                loadHomeSection('movie/top_rated', 'topRatedMovies', 'movie'),
                loadGenreSection(28, 'actionMovies', 'movie'),
                loadGenreSection(35, 'comedyMovies', 'movie'),
                loadGenreSection(16, 'animationMovies', 'movie'),
                loadHomeSection('trending/tv/week', 'trendingSeries', 'tv'),
                loadHomeSection('tv/top_rated', 'topRatedSeries', 'tv')
            ]);
            startHeroRotation();
        }

        showLoading(false);
        console.log('CinemaHalal loaded successfully!');
    } catch (error) {
        console.error('Error loading content:', error);
        showLoading(false);
    }
}

// ============== API FUNCTIONS ==============

async function fetchFromTMDB(endpoint, params = {}) {
    const queryParams = new URLSearchParams({
        language: 'en-US',
        ...params
    });

    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${TMDB_BEARER_TOKEN}`
        }
    };

    // Try each API mirror in order
    for (const baseUrl of TMDB_API_URLS) {
        try {
            const url = `${baseUrl}${endpoint}?${queryParams}`;
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`TMDB API Error (${baseUrl}):`, error.message);
            // Continue to next mirror
        }
    }

    console.error('All TMDB API mirrors failed');
    return null;
}

async function loadHeroContent() {
    // Mix trending movies and TV shows for hero
    const [movies, shows] = await Promise.all([
        fetchFromTMDB('/trending/all/day'),
        fetchFromTMDB('/movie/popular')
    ]);

    let items = [];
    if (movies?.results) items = items.concat(movies.results.slice(0, 3));
    if (shows?.results) items = items.concat(shows.results.slice(0, 2));

    // Filter based on family mode
    if (state.familyMode) {
        items = items.filter(m => !m.adult && !m.genre_ids?.some(id => BLOCKED_GENRE_IDS.includes(id)));
    }

    state.heroItems = items.slice(0, 5);
    if (state.heroItems.length > 0) {
        updateHero(0);
        renderHeroDots();
    }
}

async function loadHomeSection(endpoint, containerId, mediaType) {
    const data = await fetchFromTMDB(`/${endpoint}`, { page: 1 });

    if (data?.results) {
        let items = filterContent(data.results);
        renderHorizontalSection(items.slice(0, 20), containerId, mediaType);
    }
}

async function loadGenreSection(genreId, containerId, mediaType) {
    const endpoint = mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
    const data = await fetchFromTMDB(endpoint, {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page: 1
    });

    if (data?.results) {
        let items = filterContent(data.results);
        renderHorizontalSection(items.slice(0, 20), containerId, mediaType);
    }
}

async function loadMoviesPage(page = 1, append = false) {
    const filters = state.movieFilters;
    let endpoint, params = { page };

    switch (filters.category) {
        case 'trending':
            endpoint = '/trending/movie/week';
            break;
        case 'latest':
            endpoint = '/movie/now_playing';
            break;
        case 'top_rated':
            endpoint = '/movie/top_rated';
            break;
        case 'upcoming':
            endpoint = '/movie/upcoming';
            break;
        default:
            endpoint = '/discover/movie';
            params.sort_by = 'popularity.desc';
    }

    if (filters.genre) params.with_genres = filters.genre;
    if (filters.year) {
        if (filters.year.includes('-')) {
            const [start, end] = filters.year.split('-');
            params['primary_release_date.gte'] = `${start}-01-01`;
            params['primary_release_date.lte'] = `${end}-12-31`;
        } else {
            params.primary_release_year = filters.year;
        }
    }

    document.getElementById('moviesLoading').classList.remove('hidden');

    const data = await fetchFromTMDB(endpoint, params);

    document.getElementById('moviesLoading').classList.add('hidden');

    if (data?.results) {
        let movies = filterContent(data.results);
        renderMoviesGrid(movies, append);
        document.getElementById('moviesCount').textContent = `(${data.total_results?.toLocaleString() || 0} movies)`;

        // Hide load more if no more pages
        document.getElementById('loadMoreMovies').style.display =
            page >= data.total_pages ? 'none' : 'inline-block';
    }

    state.isLoadingMore = false;
}

async function loadSeriesPage(page = 1, append = false) {
    const filters = state.seriesFilters;
    let endpoint, params = { page };

    switch (filters.category) {
        case 'trending':
            endpoint = '/trending/tv/week';
            break;
        case 'top_rated':
            endpoint = '/tv/top_rated';
            break;
        case 'on_the_air':
            endpoint = '/tv/on_the_air';
            break;
        case 'airing_today':
            endpoint = '/tv/airing_today';
            break;
        default:
            endpoint = '/discover/tv';
            params.sort_by = 'popularity.desc';
    }

    if (filters.genre) params.with_genres = filters.genre;

    document.getElementById('seriesLoading').classList.remove('hidden');

    const data = await fetchFromTMDB(endpoint, params);

    document.getElementById('seriesLoading').classList.add('hidden');

    if (data?.results) {
        let series = filterContent(data.results);
        renderSeriesGrid(series, append);
        document.getElementById('seriesCount').textContent = `(${data.total_results?.toLocaleString() || 0} series)`;

        document.getElementById('loadMoreSeries').style.display =
            page >= data.total_pages ? 'none' : 'inline-block';
    }

    state.isLoadingMore = false;
}

async function loadSearchPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    if (!query) {
        window.location.href = 'index.html';
        return;
    }

    // Update search input value
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = query;

    // Update page title
    document.getElementById('searchQueryDisplay').textContent = query;
    document.title = `Search: ${query} - CinemaHalal`;

    document.getElementById('searchLoading').classList.remove('hidden');
    document.getElementById('noResults').classList.add('hidden');
    document.getElementById('searchGrid').innerHTML = '';

    const results = await searchContent(query);

    document.getElementById('searchLoading').classList.add('hidden');

    if (results && results.length > 0) {
        const container = document.getElementById('searchGrid');
        container.innerHTML = results.map(item => {
            const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            return createGridCard(item, mediaType);
        }).join('');

        document.getElementById('resultsCount').textContent = `(${results.length} results found)`;
    } else {
        document.getElementById('noResults').classList.remove('hidden');
        document.getElementById('resultsCount').textContent = '(0 results)';
    }
}

async function getDetails(id, mediaType) {
    return await fetchFromTMDB(`/${mediaType}/${id}`, {
        append_to_response: 'videos,credits,similar,recommendations,external_ids'
    });
}

async function getSeasonDetails(tvId, seasonNumber) {
    return await fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`);
}

async function searchContent(query) {
    const data = await fetchFromTMDB('/search/multi', { query });

    if (data?.results) {
        return filterContent(data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv'));
    }
    return [];
}

// ============== FILTER FUNCTIONS ==============

function filterContent(items) {
    if (!state.familyMode) return items;

    return items.filter(item => {
        if (item.adult) return false;
        if (item.genre_ids?.some(id => BLOCKED_GENRE_IDS.includes(id))) return false;
        return true;
    });
}

function applyMovieFilters() {
    state.movieFilters = {
        category: document.getElementById('movieCategoryFilter').value,
        genre: document.getElementById('movieGenreFilter').value,
        year: document.getElementById('movieYearFilter').value
    };
    state.moviesPage = 1;
    loadMoviesPage(1, false);
}

function applySeriesFilters() {
    state.seriesFilters = {
        category: document.getElementById('seriesCategoryFilter').value,
        genre: document.getElementById('seriesGenreFilter').value
    };
    state.seriesPage = 1;
    loadSeriesPage(1, false);
}

function filterByCategory(category) {
    document.getElementById('movieCategoryFilter').value = category;
    applyMovieFilters();
}

function filterByGenre(genreId) {
    document.getElementById('movieGenreFilter').value = genreId;
    applyMovieFilters();
}

function loadMoreMovies() {
    if (state.isLoadingMore) return;
    state.isLoadingMore = true;
    state.moviesPage++;
    loadMoviesPage(state.moviesPage, true);
}

function loadMoreSeries() {
    if (state.isLoadingMore) return;
    state.isLoadingMore = true;
    state.seriesPage++;
    loadSeriesPage(state.seriesPage, true);
}

// ============== RENDER FUNCTIONS ==============

function renderHorizontalSection(items, containerId, defaultMediaType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = items.map(item => {
        const mediaType = item.media_type || defaultMediaType;
        return createHorizontalCard(item, mediaType);
    }).join('');
}

function renderMoviesGrid(movies, append = false) {
    const container = document.getElementById('moviesGrid');
    const html = movies.map(m => createGridCard(m, 'movie')).join('');

    if (append) {
        container.innerHTML += html;
    } else {
        container.innerHTML = html;
    }
}

function renderSeriesGrid(series, append = false) {
    const container = document.getElementById('seriesGrid');
    const html = series.map(s => createGridCard(s, 'tv')).join('');

    if (append) {
        container.innerHTML += html;
    } else {
        container.innerHTML = html;
    }
}

function createHorizontalCard(item, mediaType) {
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    const rating = item.vote_average?.toFixed(1) || 'N/A';
    const poster = item.poster_path
        ? `${TMDB_IMAGE}/w342${item.poster_path}`
        : 'https://placehold.co/342x513/1f2937/6b7280?text=No+Image';
    const isInWatchlist = state.watchlist.some(w => w.id === item.id);

    return `
        <div class="horizontal-card movie-card" onclick="showDetails(${item.id}, '${mediaType}')" data-id="${item.id}">
            <div class="relative rounded-xl overflow-hidden">
                <img src="${poster}" alt="${escapeHtml(title)}" class="w-full aspect-[2/3] object-cover" loading="lazy"
                     onerror="handleImageFallback(this)">
                
                <div class="movie-overlay">
                    <div class="absolute bottom-0 left-0 right-0 p-3 movie-actions">
                        <button onclick="event.stopPropagation(); playContent(${item.id}, '${mediaType}', '${escapeHtml(title)}')" 
                                class="w-full bg-emerald-500 hover:bg-emerald-600 py-2 rounded-lg font-semibold text-sm transition play-btn">
                            <i class="fas fa-play mr-1"></i> Play
                        </button>
                        <button onclick="event.stopPropagation(); toggleWatchlist(${item.id}, '${mediaType}')" 
                                class="w-full mt-2 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition watchlist-btn ${isInWatchlist ? 'added' : ''}" data-id="${item.id}">
                            <i class="fas ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i> ${isInWatchlist ? 'Added' : 'Watchlist'}
                        </button>
                    </div>
                </div>
                
                <!-- Type Badge -->
                <div class="absolute top-2 left-2">
                    <span class="${mediaType === 'tv' ? 'badge-series' : 'badge-movie'} text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                        ${mediaType === 'tv' ? 'Series' : 'Movie'}
                    </span>
                </div>
                
                <!-- Rating -->
                <div class="absolute top-2 right-2">
                    <span class="bg-black/80 text-yellow-500 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                        <i class="fas fa-star text-[10px]"></i> ${rating}
                    </span>
                </div>
            </div>
            <div class="card-info">
                <h3 class="card-title" title="${escapeHtml(title)}">${title}</h3>
                <div class="card-meta">
                    <span>${year}</span>
                    <span class="text-emerald-400"><i class="fas fa-play text-[10px]"></i> Watch</span>
                </div>
            </div>
        </div>
    `;
}

function createGridCard(item, mediaType) {
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    const rating = item.vote_average?.toFixed(1) || 'N/A';
    const poster = item.poster_path
        ? `${TMDB_IMAGE}/w342${item.poster_path}`
        : 'https://placehold.co/342x513/1f2937/6b7280?text=No+Image';
    const isInWatchlist = state.watchlist.some(w => w.id === item.id);

    return `
        <div class="movie-card fade-in" onclick="showDetails(${item.id}, '${mediaType}')" data-id="${item.id}">
            <div class="relative">
                <img src="${poster}" alt="${escapeHtml(title)}" class="movie-poster" loading="lazy"
                     onerror="handleImageFallback(this)">
                
                <div class="movie-overlay">
                    <div class="absolute bottom-0 left-0 right-0 p-3 movie-actions">
                        <button onclick="event.stopPropagation(); playContent(${item.id}, '${mediaType}', '${escapeHtml(title)}')" 
                                class="w-full bg-emerald-500 hover:bg-emerald-600 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition play-btn">
                            <i class="fas fa-play"></i> Play
                        </button>
                        <div class="flex gap-2 mt-2">
                            <button onclick="event.stopPropagation(); toggleWatchlist(${item.id}, '${mediaType}')" 
                                    class="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition watchlist-btn ${isInWatchlist ? 'added' : ''}" data-id="${item.id}">
                                <i class="fas ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i>
                            </button>
                            <button onclick="event.stopPropagation(); showDetails(${item.id}, '${mediaType}')" 
                                    class="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition">
                                <i class="fas fa-info"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Type Badge -->
                <div class="absolute top-2 left-2">
                    <span class="${mediaType === 'tv' ? 'badge-series' : 'badge-movie'} text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                        ${mediaType === 'tv' ? 'Series' : 'Movie'}
                    </span>
                </div>
                
                <!-- Rating -->
                <div class="absolute top-2 right-2">
                    <span class="bg-black/80 text-yellow-500 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                        <i class="fas fa-star text-[10px]"></i> ${rating}
                    </span>
                </div>
                
                <!-- HD Badge -->
                <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100">
                    <span class="quality-hd text-[10px] font-bold px-2 py-0.5 rounded">HD</span>
                </div>
            </div>
            <div class="card-info">
                <h3 class="card-title" title="${escapeHtml(title)}">${title}</h3>
                <div class="card-meta">
                    <span>${year}</span>
                    <span class="${mediaType === 'tv' ? 'text-purple-400' : 'text-blue-400'}">
                        <i class="fas ${mediaType === 'tv' ? 'fa-tv' : 'fa-film'} text-[10px]"></i> 
                        ${mediaType === 'tv' ? 'Series' : 'Movie'}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// ============== HERO SECTION ==============

function updateHero(index) {
    if (!state.heroItems.length) return;

    state.currentHeroIndex = index;
    const item = state.heroItems[index];
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    const rating = item.vote_average?.toFixed(1) || 'N/A';

    const backdrop = item.backdrop_path
        ? `${TMDB_IMAGE}/original${item.backdrop_path}`
        : `${TMDB_IMAGE}/w780${item.poster_path}`;

    document.getElementById('heroBackground').style.backgroundImage = `url('${backdrop}')`;

    document.getElementById('heroContent').innerHTML = `
        <div class="flex items-center gap-3 mb-4 flex-wrap">
            <span class="${mediaType === 'tv' ? 'bg-purple-500' : 'bg-emerald-500'} text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                ${mediaType === 'tv' ? '📺 Series' : '🎬 Movie'}
            </span>
            <span class="text-gray-300 text-sm"><i class="fas fa-star text-yellow-500"></i> ${rating}</span>
            <span class="text-gray-300 text-sm">${year}</span>
        </div>
        <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">${title}</h1>
        <p class="text-gray-300 text-lg mb-6 line-clamp-3">${item.overview || 'No description available.'}</p>
        <div class="flex flex-wrap gap-4">
            <button onclick="playContent(${item.id}, '${mediaType}', '${escapeHtml(title)}')" 
                    class="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3 rounded-full flex items-center gap-2 transition transform hover:scale-105 play-btn">
                <i class="fas fa-play"></i> Play Now
            </button>
            <button onclick="showDetails(${item.id}, '${mediaType}')" 
                    class="bg-gray-800/80 hover:bg-gray-700 text-white font-semibold px-8 py-3 rounded-full flex items-center gap-2 transition border border-gray-600">
                <i class="fas fa-info-circle"></i> More Info
            </button>
            <button onclick="toggleWatchlist(${item.id}, '${mediaType}')" 
                    class="bg-gray-800/80 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-full flex items-center gap-2 transition border border-gray-600 watchlist-btn ${state.watchlist.some(w => w.id === item.id) ? 'added' : ''}" data-id="${item.id}">
                <i class="fas ${state.watchlist.some(w => w.id === item.id) ? 'fa-check' : 'fa-plus'}"></i>
            </button>
        </div>
    `;

    updateHeroDots();
}

function renderHeroDots() {
    document.getElementById('heroDots').innerHTML = state.heroItems.map((_, i) => `
        <button onclick="updateHero(${i})" 
                class="hero-dot w-3 h-3 ${i === 0 ? 'active bg-emerald-500 w-8' : 'bg-gray-600'} rounded-full transition-all hover:bg-gray-500"></button>
    `).join('');
}

function updateHeroDots() {
    document.querySelectorAll('.hero-dot').forEach((dot, i) => {
        if (i === state.currentHeroIndex) {
            dot.classList.add('active', 'bg-emerald-500', 'w-8');
            dot.classList.remove('bg-gray-600', 'w-3');
        } else {
            dot.classList.remove('active', 'bg-emerald-500', 'w-8');
            dot.classList.add('bg-gray-600', 'w-3');
        }
    });
}

function startHeroRotation() {
    setInterval(() => {
        const next = (state.currentHeroIndex + 1) % state.heroItems.length;
        updateHero(next);
    }, 8000);
}

// ============== DETAILS MODAL ==============

async function showDetails(id, mediaType) {
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <div class="p-8 flex items-center justify-center min-h-[400px]">
            <div class="text-center">
                <div class="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p class="text-gray-400">Loading details...</p>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.style.display = '';
    document.body.style.overflow = 'hidden';

    const data = await getDetails(id, mediaType);

    if (!data) {
        content.innerHTML = `<div class="p-8 text-center"><p class="text-red-500">Failed to load details</p></div>`;
        return;
    }

    state.currentMovie = data;
    state.currentMediaType = mediaType;

    const title = data.title || data.name;
    const year = (data.release_date || data.first_air_date || '').substring(0, 4);
    const rating = data.vote_average?.toFixed(1) || 'N/A';
    const runtime = data.runtime || data.episode_run_time?.[0] || 0;
    const genres = data.genres?.map(g => g.name).join(', ') || 'N/A';
    const isInWatchlist = state.watchlist.some(w => w.id === data.id);

    const backdrop = data.backdrop_path ? `${TMDB_IMAGE}/original${data.backdrop_path}` : '';
    const poster = data.poster_path
        ? `${TMDB_IMAGE}/w500${data.poster_path}`
        : 'https://placehold.co/500x750/1f2937/6b7280?text=No+Image';

    const trailer = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    const cast = data.credits?.cast?.slice(0, 10) || [];
    const similar = [...(data.similar?.results || []), ...(data.recommendations?.results || [])].slice(0, 12);

    content.innerHTML = `
        <!-- Backdrop -->
        <div class="relative h-64 md:h-80">
            ${backdrop ? `<img src="${backdrop}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" onerror="handleImageFallback(this)">` : '<div class="w-full h-full bg-gray-800"></div>'}
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>
            
            <!-- Play Button Overlay -->
            <div class="absolute inset-0 flex items-center justify-center">
                <button onclick="playContent(${data.id}, '${mediaType}', '${escapeHtml(title)}')" 
                        class="w-20 h-20 bg-emerald-500/90 rounded-full flex items-center justify-center hover:bg-emerald-500 transition pulse-green group">
                    <i class="fas fa-play text-3xl ml-1 group-hover:scale-110 transition"></i>
                </button>
            </div>
        </div>
        
        <!-- Content -->
        <div class="p-6 md:p-8">
            <div class="flex flex-col md:flex-row gap-6">
                <!-- Poster -->
                <div class="flex-shrink-0 -mt-32 md:-mt-40 z-10">
                    <img src="${poster}" alt="${escapeHtml(title)}" class="w-40 md:w-56 rounded-xl shadow-2xl mx-auto md:mx-0">
                </div>
                
                <!-- Info -->
                <div class="flex-1 md:pt-4">
                    <div class="flex flex-wrap items-center gap-3 mb-3">
                        <span class="${mediaType === 'tv' ? 'badge-series' : 'badge-movie'} text-sm font-bold px-3 py-1 rounded uppercase">
                            ${mediaType === 'tv' ? 'TV Series' : 'Movie'}
                        </span>
                        <span class="quality-hd text-sm font-bold px-3 py-1 rounded">HD</span>
                        <span class="text-yellow-500 flex items-center gap-1 font-semibold">
                            <i class="fas fa-star"></i> ${rating}/10
                        </span>
                        <span class="text-gray-400">${year}</span>
                        ${runtime ? `<span class="text-gray-400">${runtime} min</span>` : ''}
                    </div>
                    
                    <h2 class="text-2xl md:text-3xl font-bold mb-2">${title}</h2>
                    <p class="text-emerald-400 text-sm mb-4">${genres}</p>
                    <p class="text-gray-300 mb-6 line-clamp-4">${data.overview || 'No description available.'}</p>
                    
                    <!-- Actions -->
                    <div class="flex flex-wrap gap-3 mb-6">
                        <button onclick="playContent(${data.id}, '${mediaType}', '${escapeHtml(title)}')" 
                                class="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-full flex items-center gap-2 transition play-btn">
                            <i class="fas fa-play"></i> ${mediaType === 'tv' ? 'Start Watching' : 'Play Now'}
                        </button>
                        ${trailer ? `
                            <button onclick="playTrailer('${trailer.key}')" 
                                    class="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-full flex items-center gap-2 transition">
                                <i class="fab fa-youtube"></i> Trailer
                            </button>
                        ` : ''}
                        <button onclick="toggleWatchlist(${data.id}, '${mediaType}')" 
                                class="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-full flex items-center gap-2 transition watchlist-btn ${isInWatchlist ? 'added' : ''}" data-id="${data.id}">
                            <i class="fas ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i> 
                            ${isInWatchlist ? 'In Watchlist' : 'Add to List'}
                        </button>
                    </div>
                    
                    <!-- TV Show Info -->
                    ${mediaType === 'tv' && data.number_of_seasons ? `
                        <div class="bg-gray-800 rounded-lg p-4 mb-4 flex gap-6">
                            <div>
                                <span class="text-gray-400 text-sm">Seasons</span>
                                <p class="text-xl font-bold">${data.number_of_seasons}</p>
                            </div>
                            <div>
                                <span class="text-gray-400 text-sm">Episodes</span>
                                <p class="text-xl font-bold">${data.number_of_episodes || 'N/A'}</p>
                            </div>
                            <div>
                                <span class="text-gray-400 text-sm">Status</span>
                                <p class="text-xl font-bold">${data.status || 'N/A'}</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Cast -->
            ${cast.length ? `
                <div class="mt-8 border-t border-gray-700 pt-6">
                    <h3 class="text-xl font-bold mb-4"><i class="fas fa-users text-purple-500 mr-2"></i>Cast</h3>
                    <div class="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
                        ${cast.map(actor => `
                            <div class="flex-shrink-0 text-center w-24">
                                <img src="${actor.profile_path ? `${TMDB_IMAGE}/w185${actor.profile_path}` : 'https://placehold.co/185x278/1f2937/6b7280?text=No+Photo'}" 
                                     alt="${escapeHtml(actor.name)}"
                                     class="w-20 h-20 rounded-full object-cover mx-auto mb-2 border-2 border-gray-700"
                                     onerror="handleImageFallback(this)">
                                <p class="text-sm font-medium truncate">${actor.name}</p>
                                <p class="text-xs text-gray-400 truncate">${actor.character || ''}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Similar -->
            ${similar.length ? `
                <div class="mt-8 border-t border-gray-700 pt-6">
                    <h3 class="text-xl font-bold mb-4"><i class="fas fa-film text-cyan-500 mr-2"></i>You May Also Like</h3>
                    <div class="scroll-container relative">
                        <button class="scroll-btn scroll-left" onclick="scrollContainer(this, -1)"><i class="fas fa-chevron-left"></i></button>
                        <div class="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
                            ${similar.map(m => createHorizontalCard(m, mediaType)).join('')}
                        </div>
                        <button class="scroll-btn scroll-right" onclick="scrollContainer(this, 1)"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function closeModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
}

// ============== VIDEO PLAYER ==============

async function playContent(id, mediaType, title) {
    const playerModal = document.getElementById('playerModal');
    const videoFrame = document.getElementById('videoFrame');
    const episodeSelector = document.getElementById('episodeSelector');
    const videoLoading = document.getElementById('videoLoading');

    // Store current content
    state.currentMovie = { id, title };
    state.currentMediaType = mediaType;
    state.currentSeason = 1;
    state.currentEpisode = 1;
    state.currentSource = state.settings.defaultServer || 'vidsrc';
    state.availableTorrents = []; // Clear previous torrents

    // Update UI
    document.getElementById('playerTitle').textContent = title;
    playerModal.classList.remove('hidden');
    playerModal.style.display = '';
    document.body.style.overflow = 'hidden';
    closeModal();

    // Update active server tab
    renderServerTabs();

    // Show loading
    videoLoading.classList.remove('hidden');

    if (mediaType === 'tv') {
        document.getElementById('playerSubtitle').textContent = 'Loading episodes...';

        const details = await getDetails(id, 'tv');
        state.tvShowDetails = details;

        if (details?.number_of_seasons > 0) {
            const seasonSelect = document.getElementById('seasonSelect');
            seasonSelect.innerHTML = Array.from({ length: details.number_of_seasons }, (_, i) =>
                `<option value="${i + 1}">Season ${i + 1}</option>`
            ).join('');

            await loadSeasonEpisodes(1);
            episodeSelector.classList.remove('hidden');
            document.getElementById('playerSubtitle').textContent = `Season 1 • Episode 1`;
        }
    } else {
        document.getElementById('playerSubtitle').textContent = 'Movie';
        episodeSelector.classList.add('hidden');
    }

    loadStream();
    showToast(`Now playing: ${title}`, 'fa-play-circle');
}

async function loadSeasonEpisodes(seasonNumber) {
    state.currentSeason = parseInt(seasonNumber);

    const tvId = state.currentMovie.id;
    const seasonData = await getSeasonDetails(tvId, seasonNumber);

    if (seasonData?.episodes) {
        const episodeList = document.getElementById('episodeList');
        const episodeCount = document.getElementById('episodeCount');

        episodeCount.textContent = `${seasonData.episodes.length} Episodes`;

        episodeList.innerHTML = seasonData.episodes.map(ep => `
            <button onclick="playEpisode(${ep.episode_number})" 
                    class="episode-btn ${ep.episode_number === state.currentEpisode ? 'active' : ''}" data-ep="${ep.episode_number}">
                <div class="flex items-center gap-2 mb-1">
                    <span class="bg-emerald-500/80 text-xs font-bold px-2 py-0.5 rounded">E${ep.episode_number}</span>
                    ${ep.episode_number === state.currentEpisode ? '<i class="fas fa-play text-emerald-400 text-xs"></i>' : ''}
                </div>
                <h4 class="font-medium text-sm truncate">${ep.name || `Episode ${ep.episode_number}`}</h4>
                ${ep.runtime ? `<p class="text-xs text-gray-400 mt-1">${ep.runtime} min</p>` : ''}
            </button>
        `).join('');
    }
}

function playEpisode(episodeNumber) {
    state.currentEpisode = episodeNumber;
    document.getElementById('playerSubtitle').textContent = `Season ${state.currentSeason} • Episode ${episodeNumber}`;

    // Update episode buttons
    document.querySelectorAll('.episode-btn').forEach(btn => {
        const ep = parseInt(btn.dataset.ep);
        btn.classList.toggle('active', ep === episodeNumber);
    });

    loadStream();
}

async function loadStream() {
    const videoFrame = document.getElementById('videoFrame');
    const videoLoading = document.getElementById('videoLoading');
    const customPlayerWrapper = document.getElementById('customPlayerWrapper');
    const embedPlayerWrapper = document.getElementById('embedPlayerWrapper');
    const playerControls = document.getElementById('playerControls');
    const filterWarning = document.getElementById('filterWarning');
    const streamError = document.getElementById('streamError');
    if (streamError) streamError.classList.add('hidden');

    // Re-check backend server availability
    await checkStreamingServer();

    // WebTorrent flow is movie-only with the current YTS-based magnet lookup.
    // If a TV show is playing and the default is CinimaHalal Server, fall back automatically.
    if (state.currentMediaType === 'tv' && state.currentSource === 'webtorrent') {
        state.currentSource = 'multiembed';
        renderServerTabs();
        showToast('CinemaHalal Server supports movies only — switched to MultiEmbed', 'fa-info-circle');
    }

    const source = STREAM_SOURCES[state.currentSource];

    videoLoading.classList.remove('hidden');
    if (filterWarning) filterWarning.classList.add('hidden'); // Reset warning

    // Handle P2P / Custom Player
    if (source.isP2P) {
        // Current magnet lookup implementation uses YTS (movies only)
        // if (state.currentMediaType === 'tv') {
        //     showToast('Family Safe server currently supports movies only', 'fa-info-circle');
        //     videoLoading.classList.add('hidden');
        //     return;
        // }

        embedPlayerWrapper.classList.add('hidden');
        customPlayerWrapper.classList.remove('hidden');
        playerControls.classList.remove('hidden'); // Show custom controls

        // Initialize WebTorrent (only if backend isn't available)
        if (!streamingServerAvailable) {
            initWebTorrent();
        }

        // Fetch Magnet Link Automatically
        try {
            let imdbId = state.currentMovie?.external_ids?.imdb_id;

            // If we only stored {id,title} in state.currentMovie, fetch details to get external_ids
            if (!imdbId && state.currentMovie?.id) {
                const details = await getDetails(state.currentMovie.id, state.currentMediaType || 'movie');
                if (details?.external_ids) {
                    state.currentMovie = { ...details, title: details.title || details.name || state.currentMovie.title };
                    imdbId = details.external_ids.imdb_id;
                }
            }

            if (!imdbId) throw new Error('No IMDB ID found');

            const magnet = await fetchMagnet(imdbId);
            if (!magnet) throw new Error("No magnet link found");

            streamTorrent(magnet);
        } catch (e) {
            videoLoading.classList.add('hidden');

            console.error('[CinemaHalal][Server] Magnet fetch error', {
                error: e,
                message: e?.message,
                currentSource: state.currentSource,
                mediaType: state.currentMediaType,
                tmdbId: state.currentMovie?.id,
                imdbId: state.currentMovie?.external_ids?.imdb_id
            });

            let details;
            if (e?.message === 'No magnet link found') {
                details = streamingServerAvailable
                    ? 'No torrent was found for this movie. Try switching to another server manually.'
                    : 'Could not reach the torrent provider or no torrent was found. Try starting the backend server for better reliability, or switch to another server.';
            } else {
                details = 'Could not fetch a streaming URL (magnet link). Check your network connection and try again, or switch to another server.';
            }

            showStreamError('CinemaHalal Server is unavailable', details);
        }
        return;
    }

    // Handle Iframe Embeds
    customPlayerWrapper.classList.add('hidden');
    playerControls.classList.add('hidden'); // Hide custom controls for iframes
    embedPlayerWrapper.classList.remove('hidden');

    // Show Warning for non-safe servers
    if (filterWarning) filterWarning.classList.remove('hidden');

    const sub = state.settings.defaultSubtitle || '';
    let streamUrl;

    if (state.currentMediaType === 'tv') {
        streamUrl = source.tv(state.currentMovie.id, state.currentSeason, state.currentEpisode, sub);
    } else {
        streamUrl = source.movie(state.currentMovie.id, sub);
    }

    console.log('Loading stream:', streamUrl);
    videoFrame.src = streamUrl;

    videoFrame.onload = () => {
        setTimeout(() => videoLoading.classList.add('hidden'), 1000);
    };

    // Fallback hide loading after timeout
    setTimeout(() => videoLoading.classList.add('hidden'), 5000);
}

async function fetchMagnet(imdbId) {
    showToast("Searching for safe stream...", "fa-search");

    // Get movie title from TMDB for better torrent search
    let searchQuery = '';
    if (state.currentMovie?.title || state.currentMovie?.name) {
        searchQuery = state.currentMovie.title || state.currentMovie.name;
    } else {
        console.warn('[CinemaHalal] No movie title available, search may be less accurate');
        searchQuery = imdbId;
    }

    // Append Season/Episode for TV Shows
    if (state.currentMediaType === 'tv') {
        const s = state.currentSeason.toString().padStart(2, '0');
        const e = state.currentEpisode.toString().padStart(2, '0');
        searchQuery += ` S${s}E${e}`;
        console.log('[CinemaHalal] TV Search Query:', searchQuery);
    }

    // STRATEGY 1: Use backend streaming server if available (most reliable)
    if (streamingServerAvailable) {
        try {
            console.log('[CinemaHalal] Searching via backend server...');
            const res = await fetch(`${STREAMING_SERVER_URL}/api/search?query=${encodeURIComponent(searchQuery)}&imdbId=${encodeURIComponent(imdbId || '')}`);

            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    state.availableTorrents = data.results;
                    console.log('[Backend] Found torrents:', data.results.length);
                    return data.results[0].magnet;
                }
            }
        } catch (e) {
            console.warn('[Backend] Search failed, falling back to direct APIs:', e.message);
        }
    }

    // STRATEGY 2: Try YTS direct API (fallback for movies)
    // YTS only supports movies, so skip if TV
    if (state.currentMediaType !== 'tv') {
        try {
            const ytsResults = await searchYTSDirect(searchQuery);
            if (ytsResults && ytsResults.length > 0) {
                state.availableTorrents = ytsResults;
                console.log('[YTS Direct] Available torrents:', ytsResults.length);
                return ytsResults[0].magnet;
            }
        } catch (e) {
            console.warn('[YTS Direct] Failed:', e.message);
        }
    }

    // STRATEGY 2.5: Try 1337x via Electron (Bypasses Cloudflare) - Great for TV Shows & Movies
    if (window.electronAPI && window.electronAPI.search1337x) {
        try {
            console.log('[CinemaHalal] Searching 1337x via Electron...');
            showToast('Searching 1337x (Deep Search)...', 'fa-search');
            const l337xResults = await window.electronAPI.search1337x(searchQuery);

            if (l337xResults && l337xResults.length > 0) {
                console.log('[Electron 1337x] Found torrents:', l337xResults.length);

                // Merge with existing results (if any)
                const combined = [...(state.availableTorrents || []), ...l337xResults];

                // Deduplicate
                const unique = [];
                const seen = new Set();
                combined.forEach(t => {
                    const key = t.infoHash || t.magnet;
                    if (!seen.has(key)) { seen.add(key); unique.push(t); }
                });

                // Sort by seeders
                unique.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
                state.availableTorrents = unique;

                return unique[0].magnet;
            }
        } catch (e) {
            console.warn('[Electron 1337x] Failed:', e);
        }
    }

    // STRATEGY 3: Fallback to multiple torrent search APIs
    const torrentSites = ['piratebay', '1337x', 'torlock'];
    let allTorrents = [];

    // Search in parallel with timeout
    const promises = torrentSites.map(site => searchTorrentSite(site, searchQuery));
    const results = await Promise.all(promises);

    results.forEach(siteResults => {
        if (Array.isArray(siteResults)) {
            allTorrents = [...allTorrents, ...siteResults];
        }
    });

    if (allTorrents.length === 0) {
        console.log('[CinemaHalal] All torrent sources exhausted');
        return null;
    }

    // Deduplicate based on infohash if available, or name
    const uniqueTorrents = [];
    const seen = new Set();

    allTorrents.forEach(t => {
        const key = t.infoHash || t.magnet || t.name;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTorrents.push(t);
        }
    });

    // Sort by seeders (most seeds first)
    uniqueTorrents.sort((a, b) => parseInt(b.seeders || 0) - parseInt(a.seeders || 0));

    // Store for quality selector
    state.availableTorrents = uniqueTorrents;
    console.log('[CinemaHalal] Available torrents:', uniqueTorrents.length);

    return uniqueTorrents[0].magnet;
}

async function searchYTSDirect(query) {
    try {
        // YTS has a reliable official API
        const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&limit=20&sort_by=seeds`;

        console.log('[YTS Direct] Searching for:', query);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (data && data.data && data.data.movies && data.data.movies.length > 0) {
            const torrents = [];

            data.data.movies.forEach(movie => {
                if (movie.torrents && movie.torrents.length > 0) {
                    movie.torrents.forEach(torrent => {
                        if (torrent.hash) {
                            // Build magnet link from hash
                            const magnet = `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movie.title_long)}`;

                            torrents.push({
                                name: `${movie.title_long} [${torrent.quality}] [${torrent.type}]`,
                                magnet: magnet,
                                seeders: torrent.seeds || 0,
                                size: torrent.size || 'Unknown',
                                quality: torrent.quality,
                                infoHash: torrent.hash
                            });
                        }
                    });
                }
            });

            console.log(`[YTS Direct] Found ${torrents.length} torrents`);
            return torrents.sort((a, b) => parseInt(b.seeders) - parseInt(a.seeders));
        }

        return [];
    } catch (e) {
        console.warn('[YTS Direct] Error:', e.message);
        return [];
    }
}

async function searchTorrentSite(site, query) {
    try {
        // Multiple fallback APIs for better reliability
        const apiEndpoints = [
            'https://torrent-api-py-nx0x.onrender.com/api/v1',
            'https://torrentapi.onrender.com/api/v1',
            'https://torrent-search-api.vercel.app/api/v1'
        ];

        // Try each API endpoint
        for (const apiBase of apiEndpoints) {
            try {
                const url = `${apiBase}/search?site=${site}&query=${encodeURIComponent(query)}&limit=10`;

                console.log(`[Torrent] Searching ${site} via ${apiBase.split('/')[2]} for: ${query}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    console.warn(`[Torrent] API ${apiBase.split('/')[2]} returned ${res.status}, trying next...`);
                    continue; // Try next API
                }

                const data = await res.json();

                if (data && data.data && data.data.length > 0) {
                    // Return all valid torrents
                    console.log(`[Torrent] Found ${data.data.length} results on ${site}`);
                    return data.data.filter(t => t.magnet && parseInt(t.seeders || 0) > 0);
                }
            } catch (apiError) {
                console.warn(`[Torrent] API ${apiBase.split('/')[2]} error:`, apiError.message);
                // Continue to next API
            }
        }

        console.log(`[Torrent] No results on ${site} (all APIs tried)`);
        return [];
    } catch (e) {
        console.warn(`[Torrent] ${site} failed:`, e.message);
        return [];
    }
}

// ============== WEBTORRENT & FILTERS ==============

function initWebTorrent() {
    if (!wtClient) {
        try {
            // Initialize with DHT enabled for better peer discovery
            wtClient = new WebTorrent({
                tracker: {
                    rtcConfig: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    }
                },
                dht: true,
                maxConns: 55
            });
            console.log('[WebTorrent] Browser client initialized');

            // Global error handler
            wtClient.on('error', (err) => {
                console.error('[WebTorrent] Global error:', err);
            });
        } catch (e) {
            console.error('[WebTorrent] Failed to initialize:', e);
            showToast('WebTorrent not available in this browser', 'fa-exclamation-triangle');
        }
    }
}

function streamTorrent(magnetURI) {
    const videoLoading = document.getElementById('videoLoading');
    const videoElement = document.getElementById('customVideo');

    // Clean up previous torrents (browser client)
    if (wtClient && wtClient.torrents.length > 0) {
        wtClient.torrents.forEach(t => t.destroy());
    }

    // STRATEGY: Try backend server first, then fallback to browser WebTorrent
    if (streamingServerAvailable) {
        streamViaBackend(magnetURI, videoElement, videoLoading);
    } else {
        streamViaBrowserWebTorrent(magnetURI, videoElement, videoLoading);
    }
}

/**
 * Stream via backend server (RELIABLE - uses Node.js WebTorrent)
 * This bypasses all browser limitations (DHT works, UDP trackers work, etc.)
 */
async function streamViaBackend(magnetURI, videoElement, videoLoading) {
    console.log('[Backend] Preparing stream...');
    showToast('Connecting to streaming server...', 'fa-server');

    try {
        // Request the server to prepare the stream
        const res = await fetch(`${STREAMING_SERVER_URL}/api/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ magnet: magnetURI })
        });

        const data = await res.json();

        if (!res.ok || data.error) {
            // Handle specific error codes
            const errorCode = data.error || 'UNKNOWN_ERROR';
            const errorMsg = data.message || 'Streaming failed';

            console.error(`[Backend] Error: ${errorCode} - ${errorMsg}`);

            if (errorCode === 'METADATA_TIMEOUT' || errorCode === 'NO_SEEDS') {
                showStreamError('No Seeds Available',
                    'This torrent has no active seeders. Try switching to "VidSrc" or "MultiEmbed" server for instant playback.');
            } else if (errorCode === 'NO_VIDEO_FILE') {
                showStreamError('No Video Found',
                    'The torrent does not contain a playable video file.');
            } else {
                showStreamError('Streaming Error', errorMsg);
            }

            videoLoading.classList.add('hidden');

            // Fallback: Try browser WebTorrent as last resort
            console.log('[Backend] Falling back to browser WebTorrent...');
            streamViaBrowserWebTorrent(magnetURI, videoElement, videoLoading);
            return;
        }

        if (data.status === 'STREAM_READY') {
            console.log('[Backend] Stream ready:', data.streamUrl);
            showToast(`Streaming: ${data.videoFile.substring(0, 40)}...`, 'fa-play');

            // Set video source to backend stream URL
            videoElement.src = data.streamUrl;
            videoElement.load();

            // Store info hash for status polling
            state.currentStreamInfoHash = data.infoHash;

            videoElement.addEventListener('canplay', () => {
                console.log('[Backend] Video can play');
                videoLoading.classList.add('hidden');
                showToast('Ready to play!', 'fa-check');
            }, { once: true });

            videoElement.addEventListener('error', (e) => {
                console.error('[Backend] Video element error:', e);
                showStreamError('Playback Error', 'The video format may not be supported by your browser.');
                videoLoading.classList.add('hidden');
            }, { once: true });

            // Setup content filters
            setupContentFilters(videoElement);

            // Start polling for stream status
            pollStreamStatus(data.infoHash, videoLoading);
        }
    } catch (error) {
        console.error('[Backend] Request failed:', error);
        showToast('Server connection failed, trying browser...', 'fa-exclamation-triangle');

        // Fallback to browser WebTorrent
        streamViaBrowserWebTorrent(magnetURI, videoElement, videoLoading);
    }
}

/**
 * Poll stream status from backend (for progress display)
 */
async function pollStreamStatus(infoHash, videoLoading) {
    const interval = setInterval(async () => {
        // Stop polling if stream is no longer active
        if (state.currentStreamInfoHash !== infoHash) {
            clearInterval(interval);
            return;
        }

        try {
            const res = await fetch(`${STREAMING_SERVER_URL}/api/stream/${infoHash}/status`);
            if (res.ok) {
                const status = await res.json();

                // Update loading text with download progress
                if (videoLoading && !videoLoading.classList.contains('hidden')) {
                    const loadingText = videoLoading.querySelector('p.text-gray-400');
                    if (loadingText && status.videoFile) {
                        const downloaded = (status.videoFile.downloaded / 1024 / 1024).toFixed(1);
                        const speed = (status.downloadSpeed / 1024 / 1024).toFixed(2);
                        loadingText.innerHTML = `
                            <span class="text-white font-bold">Buffering: ${downloaded} MB ready</span>
                            <br>
                            <span class="text-xs text-gray-400">Speed: ${speed} MB/s • Peers: ${status.numPeers}</span>
                            <br>
                            <span class="text-xs text-emerald-400 mt-1 block">✓ Using reliable backend server</span>
                        `;
                    }
                }

                // Stop polling once video is fully buffered or player is ready
                if (status.progress >= 100) {
                    clearInterval(interval);
                }
            }
        } catch (e) {
            // Silently fail - not critical
        }
    }, 2000);

    // Stop polling after 5 minutes max
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
}

/**
 * Stream via browser WebTorrent (FALLBACK - has limitations)
 * This is less reliable due to DHT/tracker limitations in browsers
 */
function streamViaBrowserWebTorrent(magnetURI, videoElement, videoLoading) {
    console.log('[Browser WebTorrent] Falling back to browser-based streaming...');
    showToast('Using browser streaming (may be slower)...', 'fa-globe');

    // Ensure the browser WebTorrent client exists before calling wtClient.add
    if (!wtClient) {
        initWebTorrent();
    }
    if (!wtClient) {
        videoLoading.classList.add('hidden');
        showStreamError('WebTorrent Unavailable', 'WebTorrent could not be initialized in this browser. Start the backend server or switch to another server.');
        return;
    }

    // Add WebSocket trackers for browser support (Critical for WebTorrent)
    const wsTrackers = [
        "wss://tracker.openwebtorrent.com",
        "wss://tracker.webtorrent.dev",
        "wss://tracker.files.fm:7073/announce"
    ];

    // Add UDP/HTTP trackers (WebTorrent will use them via DHT)
    const httpTrackers = [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://open.stealth.si:80/announce",
        "udp://tracker.torrent.eu.org:451/announce",
        "udp://tracker.moeking.me:6969/announce",
        "udp://explodie.org:6969/announce",
        "https://tracker.nanoha.org:443/announce",
        "https://tracker.lilithraws.org:443/announce"
    ];

    const allTrackers = [...wsTrackers, ...httpTrackers];
    const finalMagnet = magnetURI + "&tr=" + allTrackers.map(encodeURIComponent).join("&tr=");

    console.log('[Browser WebTorrent] Adding magnet with WS trackers...');

    // Timeout if metadata takes too long
    const metaTimeout = setTimeout(() => {
        console.warn('[Browser WebTorrent] Metadata timeout');
        showStreamError('No WebRTC Peers Found',
            'This torrent does not support browser streaming (WebRTC). Please switch to "VidSrc" or "MultiEmbed" server, or start the backend server for reliable streaming.');
        videoLoading.classList.add('hidden');
    }, 45000);

    wtClient.add(finalMagnet, function (torrent) {
        clearTimeout(metaTimeout);
        console.log('[Browser WebTorrent] Torrent metadata received:', torrent.name);
        console.log('[Browser WebTorrent] Files:', torrent.files.map(f => f.name));
        console.log('[Browser WebTorrent] Peers:', torrent.numPeers);

        // Show download progress
        torrent.on('download', (bytes) => {
            const percent = Math.round(torrent.progress * 100);
            const downloaded = (torrent.downloaded / 1024 / 1024).toFixed(1);
            const total = (torrent.length / 1024 / 1024).toFixed(1);
            const speed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);

            console.log(`[Browser WebTorrent] Progress: ${percent}% (${downloaded}MB / ${total}MB) - Speed: ${speed} MB/s - Peers: ${torrent.numPeers}`);

            // Update loading text with detailed status
            if (videoLoading && !videoLoading.classList.contains('hidden')) {
                const loadingText = videoLoading.querySelector('p.text-gray-400');
                if (loadingText) {
                    loadingText.innerHTML = `
                        <span class="text-white font-bold">Buffering: ${downloaded} MB ready</span>
                        <br>
                        <span class="text-xs text-gray-400">Speed: ${speed} MB/s • Peers: ${torrent.numPeers}</span>
                        <br>
                        <span class="text-xs text-yellow-400 mt-1 block">⚠ Browser mode - Start backend server for better streaming</span>
                    `;
                }
            }
        });

        // Check for low peers after 15 seconds
        setTimeout(() => {
            if (torrent.numPeers < 3 && videoLoading && !videoLoading.classList.contains('hidden')) {
                showToast('Low peer count - streaming may be slow', 'fa-exclamation-triangle');
                const loadingText = videoLoading.querySelector('p.text-gray-400');
                if (loadingText) {
                    loadingText.innerHTML += `<br><span class="text-yellow-500 text-xs mt-2 block"><i class="fas fa-exclamation-triangle"></i> Try "VidSrc" server for instant playback.</span>`;
                }
            }
        }, 15000);

        // Find the largest video file
        let videoFile = torrent.files.find(file =>
            file.name.endsWith('.mp4') ||
            file.name.endsWith('.mkv') ||
            file.name.endsWith('.webm') ||
            file.name.endsWith('.avi') ||
            file.name.endsWith('.mov')
        );

        // If no video file found by extension, get the largest file
        if (!videoFile) {
            videoFile = torrent.files.reduce((largest, file) =>
                file.length > largest.length ? file : largest
            );
            console.warn('[Browser WebTorrent] No video extension found, using largest file:', videoFile.name);
        }

        if (!videoFile) {
            videoLoading.classList.add('hidden');
            showStreamError('No playable video file found', 'This torrent does not contain a video file.');
            return;
        }

        console.log('[Browser WebTorrent] Selected file:', videoFile.name, 'Size:', (videoFile.length / 1024 / 1024 / 1024).toFixed(2), 'GB');
        showToast(`Streaming: ${videoFile.name.substring(0, 40)}...`, 'fa-play');

        // Render to the video tag
        videoFile.renderTo(videoElement, { autoplay: false }, function (err, elem) {
            if (err) {
                console.error('[Browser WebTorrent] Render error:', err);
                videoLoading.classList.add('hidden');
                showStreamError('Failed to load video', err.message);
                return;
            }

            console.log('[Browser WebTorrent] Video element ready');
            videoLoading.classList.add('hidden');

            // Setup filters
            setupContentFilters(elem);

            // Auto-play with user interaction check
            elem.addEventListener('canplay', () => {
                console.log('[Browser WebTorrent] Video can play');
                showToast('Ready to play!', 'fa-check');
            }, { once: true });
        });
    });

    wtClient.on('error', function (err) {
        console.error('[Browser WebTorrent] Client error:', err);
        showToast('Torrent error: ' + err.message, 'fa-exclamation-circle');
        videoLoading.classList.add('hidden');
        showStreamError('Browser WebTorrent Error', err.message || 'Unknown error');
    });
}

// Content Filter Logic
let activeFilters = [];

function setupContentFilters(videoElement) {
    // Example Filters (Skip 10s-15s, Mute 20s-25s)
    // In a real app, these would be generated from subtitles or a database
    activeFilters = [
        { start: 10, end: 15, type: 'skip', reason: 'Intro' },
        { start: 20, end: 25, type: 'mute', reason: 'Profanity' }
    ];

    videoElement.addEventListener('timeupdate', () => {
        const currentTime = videoElement.currentTime;
        const subtitleText = document.getElementById('subtitleText');

        // Check active filters
        const activeFilter = activeFilters.find(f => currentTime >= f.start && currentTime < f.end);

        if (activeFilter) {
            if (activeFilter.type === 'skip') {
                console.log(`Skipping: ${activeFilter.reason}`);
                videoElement.currentTime = activeFilter.end;
                showToast(`Skipped: ${activeFilter.reason}`, 'fa-forward');
            }
            else if (activeFilter.type === 'mute') {
                if (!videoElement.muted) {
                    console.log(`Muting: ${activeFilter.reason}`);
                    videoElement.muted = true;
                    subtitleText.textContent = '🔇 [Audio Muted]';
                    subtitleText.style.color = 'red';
                }
            }
        } else {
            // Restore state if we just left a filter zone
            // Note: This is a simple check. In a complex app, we'd track "wasMutedByFilter"
            if (videoElement.muted && !playerState.isMuted) {
                videoElement.muted = false;
                subtitleText.textContent = '';
            }
        }

        // Update UI Progress Bar (if custom controls are used)
        updateProgressBar(videoElement);
    });
}

function updateProgressBar(video) {
    const progressBar = document.getElementById('progressPlayed');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');

    if (progressBar && video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        progressBar.style.width = `${percent}%`;

        currentTimeEl.textContent = formatTime(video.currentTime);
        durationEl.textContent = formatTime(video.duration);
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function togglePlayPause() {
    const video = document.getElementById('customVideo');
    const icon = document.getElementById('playPauseIcon');

    if (video.paused) {
        video.play();
        icon.className = 'fas fa-pause';
    } else {
        video.pause();
        icon.className = 'fas fa-play';
    }
}

function toggleMute() {
    const video = document.getElementById('customVideo');
    const icon = document.getElementById('volumeIcon');

    video.muted = !video.muted;
    playerState.isMuted = video.muted;

    if (video.muted) {
        icon.className = 'fas fa-volume-mute';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

function setVolume(val) {
    const video = document.getElementById('customVideo');
    video.volume = val;
}

function seekVideo(event) {
    const video = document.getElementById('customVideo');
    const progressBar = document.getElementById('progressBar');
    const rect = progressBar.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;

    if (video.duration) {
        video.currentTime = pos * video.duration;
    }
}

function skipVideo(seconds) {
    const video = document.getElementById('customVideo');
    video.currentTime += seconds;
}

function toggleFullscreen() {
    const container = document.getElementById('videoContainer');
    if (!document.fullscreenElement) {
        container.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function handleVideoClick(event) {
    // Prevent clicks on controls from triggering container behavior
    const controls = document.getElementById('playerControls');
    if (controls && controls.contains(event.target)) return;

    // Always reveal controls/topbar briefly
    showPlayerControls();

    // If we're using the custom HTML5 player, click toggles play/pause
    const customPlayerWrapper = document.getElementById('customPlayerWrapper');
    const usingCustomPlayer = customPlayerWrapper && !customPlayerWrapper.classList.contains('hidden');
    if (usingCustomPlayer) {
        togglePlayPause();
    }
}

async function togglePiP() {
    // PiP only works for the custom <video> element (not cross-origin iframes)
    const video = document.getElementById('customVideo');
    if (!video) {
        showToast('Picture-in-Picture is only available on the Family Safe player', 'fa-info-circle');
        return;
    }

    const customPlayerWrapper = document.getElementById('customPlayerWrapper');
    const usingCustomPlayer = customPlayerWrapper && !customPlayerWrapper.classList.contains('hidden');
    if (!usingCustomPlayer) {
        showToast('Switch to Family Safe server to use PiP', 'fa-info-circle');
        return;
    }

    if (!document.pictureInPictureEnabled) {
        showToast('Picture-in-Picture not supported in this browser', 'fa-exclamation-circle');
        return;
    }

    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            await video.requestPictureInPicture();
        }
    } catch (err) {
        console.warn('PiP error:', err);
        showToast('Could not enable Picture-in-Picture', 'fa-exclamation-circle');
    }
}

function toggleSpeedMenu() {
    const menu = document.getElementById('speedMenu');
    if (!menu) return;
    menu.classList.toggle('hidden');
}

function setPlaybackSpeed(speed) {
    const video = document.getElementById('customVideo');
    const label = document.getElementById('speedLabel');
    const menu = document.getElementById('speedMenu');

    if (video) video.playbackRate = speed;
    if (label) label.textContent = `${speed}x`;
    if (menu) menu.classList.add('hidden');
}

function showPlayerControls() {
    const controls = document.getElementById('playerControls');
    const topBar = document.getElementById('playerTopBar');

    if (!controls || !topBar) return;

    controls.classList.remove('opacity-0');
    topBar.classList.remove('opacity-0');

    clearTimeout(playerState.controlsTimeout);
    playerState.controlsTimeout = setTimeout(() => {
        const customVideo = document.getElementById('customVideo');
        if (customVideo && !customVideo.paused) {
            controls.classList.add('opacity-0');
            topBar.classList.add('opacity-0');
        }
    }, 3000);
}

function renderServerTabs() {
    const container = document.getElementById('serverTabs');
    container.innerHTML = Object.entries(STREAM_SOURCES).map(([key, source]) => `
        <button onclick="changeSource('${key}')" 
                class="server-tab ${state.currentSource === key ? 'active' : ''}" 
                data-source="${key}">
            <i class="fas ${source.icon || 'fa-server'}"></i>
            ${source.name}
            ${source.isP2P ? '<span class="ml-1 text-[10px] bg-emerald-500 text-white px-1 rounded">SAFE</span>' : ''}
        </button>
    `).join('');
}

function changeSource(source) {
    state.currentSource = source;
    renderServerTabs(); // Re-render to update active state

    if (state.currentMovie) {
        // If switching to/from P2P, we need to reload the stream logic completely
        loadStream();
        showToast(`Switched to ${STREAM_SOURCES[source].name}`, 'fa-server');
    }
}

// ============== QUALITY SELECTOR ==============

function toggleQualityMenu() {
    const menu = document.getElementById('qualityMenu');
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
        renderQualityMenu();
        menu.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
    }
}

function renderQualityMenu() {
    const menu = document.getElementById('qualityMenu');
    if (!state.availableTorrents || state.availableTorrents.length === 0) {
        menu.innerHTML = '<div class="px-4 py-2 text-sm text-gray-400">No qualities found</div>';
        return;
    }

    menu.innerHTML = state.availableTorrents.map((t, index) => {
        const size = t.size || 'Unknown';
        const seeds = t.seeders || 0;
        const name = t.name || 'Unknown';

        // Try to guess resolution
        let quality = 'Unknown';
        if (name.includes('2160p') || name.includes('4k') || name.includes('4K')) quality = '4K';
        else if (name.includes('1080p')) quality = '1080p';
        else if (name.includes('720p')) quality = '720p';
        else if (name.includes('480p')) quality = '480p';
        else if (name.includes('CAM')) quality = 'CAM';

        const isSelected = wtClient && wtClient.torrents[0] && wtClient.torrents[0].magnetURI === t.magnet;

        return `
            <button onclick="changeQuality(${index})" class="block w-full px-4 py-2 text-left hover:bg-white/10 text-sm transition ${isSelected ? 'text-emerald-400 font-bold' : 'text-gray-300'}">
                <div class="flex justify-between items-center">
                    <span>${quality}</span>
                    <span class="text-xs text-gray-500">${size}</span>
                </div>
                <div class="text-[10px] text-gray-500 truncate">${seeds} seeds • ${t.site || 'source'}</div>
            </button>
        `;
    }).join('');
}

function changeQuality(index) {
    const torrent = state.availableTorrents[index];
    if (!torrent) return;

    document.getElementById('qualityMenu').classList.add('hidden');

    // Update label
    let quality = 'Auto';
    const name = torrent.name || '';
    if (name.includes('2160p') || name.includes('4k') || name.includes('4K')) quality = '4K';
    else if (name.includes('1080p')) quality = '1080p';
    else if (name.includes('720p')) quality = '720p';
    else if (name.includes('480p')) quality = '480p';
    document.getElementById('qualityLabel').textContent = quality;

    showToast(`Switching to ${quality}...`, 'fa-sync');

    // Stop current stream before switching
    if (state.currentStreamInfoHash && streamingServerAvailable) {
        fetch(`${STREAMING_SERVER_URL}/api/stream/${state.currentStreamInfoHash}`, {
            method: 'DELETE'
        }).catch(() => { });
        state.currentStreamInfoHash = null;
    }

    streamTorrent(torrent.magnet);
}

// ============== SUBTITLE SELECTOR ==============

function openSubtitleSelector() {
    document.getElementById('subtitleSelectorModal').classList.remove('hidden');
    loadSubtitleLanguages();
}

function closeSubtitleSelector() {
    document.getElementById('subtitleSelectorModal').classList.add('hidden');
}

async function loadSubtitleLanguages() {
    const grid = document.getElementById('subtitleLanguageGrid');
    grid.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading languages...</div>';

    // Common languages
    const languages = [
        { code: 'en', name: 'English' },
        { code: 'ar', name: 'Arabic' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'zh', name: 'Chinese' },
        { code: 'hi', name: 'Hindi' },
        { code: 'tr', name: 'Turkish' }
    ];

    grid.innerHTML = languages.map(lang => `
        <button onclick="selectSubtitleLanguage('${lang.code}')" class="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition group">
            <span class="font-medium">${lang.name}</span>
            <span class="text-xs text-gray-500 group-hover:text-emerald-400 uppercase">${lang.code}</span>
        </button>
    `).join('');
}

async function selectSubtitleLanguage(langCode) {
    closeSubtitleSelector();
    showToast(`Loading ${langCode.toUpperCase()} subtitles...`, 'fa-closed-captioning');

    if (state.currentMovie?.external_ids?.imdb_id) {
        // Use the existing fetchSubtitle function but with the selected language
        // Note: fetchSubtitle currently hardcodes 'eng'. I should update it.
        const srtText = await fetchSubtitle(state.currentMovie.external_ids.imdb_id, langCode);
        if (srtText) {
            const subtitles = parseSRT(srtText);
            // Re-generate filters if needed, or just display them
            // For now, we just use them for the filter logic, but we should also display them on screen
            // The current implementation only uses subtitles for filtering profanity!
            // I should add logic to display them too.

            // Update active filters
            const muteFilters = generateMuteFilters(subtitles);
            activeFilters = muteFilters;
            showToast(`Loaded & Filtered: ${muteFilters.length} words`, 'fa-check');
        } else {
            showToast('No subtitles found for this language', 'fa-times');
        }
    }
}

// ============== SUBTITLE PARSING & FILTER GENERATION ==============

async function loadSubtitlesForFilter() {
    console.log("Loading subtitles for filtering...");
    showToast("Analyzing audio for profanity...", "fa-cog fa-spin");

    let srtText = null;

    // Try to fetch real subtitles if we have an IMDB ID
    if (state.currentMovie.external_ids?.imdb_id) {
        srtText = await fetchSubtitle(state.currentMovie.external_ids.imdb_id);
    }

    if (!srtText) {
        console.log("Using mock subtitles (fallback)");
        // Mock SRT for testing (Sintel has no profanity, so we'll fake some)
        srtText = `
1
00:00:20,000 --> 00:00:25,000
This is a test subtitle with a bad word: damn.

2
00:00:30,000 --> 00:00:35,000
Here is another one: hell.
        `;
    }

    const subtitles = parseSRT(srtText);
    state.currentSubtitles = subtitles; // Store full subtitles for display
    const muteFilters = generateMuteFilters(subtitles);

    // Merge with existing filters
    activeFilters = [...activeFilters, ...muteFilters];

    console.log("Generated Filters:", activeFilters);
    showToast(`Filters applied: ${muteFilters.length} words muted`, "fa-shield-alt");
}

async function fetchSubtitle(imdbId, lang = 'en') {
    try {
        // Map common codes to OpenSubtitles format if needed (usually ISO 639-1 is fine)
        // OpenSubtitles uses 'eng', 'spa', 'ara' etc (ISO 639-2B) usually, but let's try with what we have or map it.
        const langMap = {
            'en': 'eng', 'ar': 'ara', 'es': 'spa', 'fr': 'fre', 'de': 'ger',
            'it': 'ita', 'pt': 'por', 'ru': 'rus', 'ja': 'jpn', 'ko': 'kor',
            'zh': 'chi', 'hi': 'hin', 'tr': 'tur'
        };
        const subLangId = langMap[lang] || 'all';

        // Using OpenSubtitles REST API (Unofficial/Public)
        const searchUrl = `https://rest.opensubtitles.org/search/imdbid-${imdbId}/sublanguageid-${subLangId}`;

        const response = await fetch(searchUrl, {
            headers: { 'User-Agent': 'CinimaWebClient v1.0' }
        });

        if (!response.ok) throw new Error("Subtitle API error");

        const data = await response.json();

        if (data && data.length > 0) {
            // Get the first subtitle download link
            const downloadUrl = data[0].SubDownloadLink;

            // Fetch the subtitle file
            const subResponse = await fetch(downloadUrl);
            const blob = await subResponse.blob();

            // Try to decompress if it's gzip (using DecompressionStream if available)
            if ('DecompressionStream' in window) {
                try {
                    const ds = new DecompressionStream('gzip');
                    const decompressedStream = blob.stream().pipeThrough(ds);
                    const text = await new Response(decompressedStream).text();
                    return text;
                } catch (e) {
                    // Maybe it wasn't gzipped?
                    return await blob.text();
                }
            } else {
                // Fallback for browsers without DecompressionStream
                return await blob.text();
            }
        }
    } catch (e) {
        console.warn("Could not fetch real subtitles:", e);
    }
    return null;
}

function parseSRT(data) {
    const pattern = /(\d+)\n([\d:,]+)\s-->\s([\d:,]+)\n([\s\S]*?(?=\n\n|\n$))/g;
    const result = [];
    let match;

    while ((match = pattern.exec(data + '\n\n')) != null) {
        result.push({
            id: match[1],
            startTime: timeToSeconds(match[2]),
            endTime: timeToSeconds(match[3]),
            text: match[4].replace(/\r\n|\r|\n/g, ' ')
        });
    }
    return result;
}

function timeToSeconds(timeString) {
    const parts = timeString.split(':');
    const seconds = parts[2].split(',');
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(seconds[0], 10) + parseInt(seconds[1], 10) / 1000;
}

// Profanity Lists for Family Mode
const PROFANITY_LISTS = {
    mild: ['damn', 'hell', 'crap', 'bloody', 'bugger'],
    moderate: ['shit', 'bitch', 'bastard', 'ass', 'asshole', 'dick', 'piss'],
    strict: ['fuck', 'cunt', 'motherfucker', 'cock', 'pussy', 'twat', 'wanker']
};

function generateMuteFilters(subtitles) {
    const filters = [];
    // Flatten all profanity lists into one array
    const badWords = [...PROFANITY_LISTS.mild, ...PROFANITY_LISTS.moderate, ...PROFANITY_LISTS.strict];

    subtitles.forEach(sub => {
        const words = sub.text.toLowerCase().split(/\s+/);
        const containsBadWord = words.some(word => {
            // Remove punctuation
            const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
            return badWords.includes(cleanWord);
        });

        if (containsBadWord) {
            filters.push({
                start: sub.startTime,
                end: sub.endTime,
                type: 'mute',
                reason: 'Profanity detected in subtitle'
            });
        }
    });

    return filters;
}

// Auto-load filters when streaming starts
function setupContentFilters(videoElement) {
    // Reset filters
    activeFilters = [
        // Keep the demo skip for Sintel Intro
        { start: 0, end: 10, type: 'skip', reason: 'Sintel Intro' }
    ];

    // Trigger subtitle analysis
    loadSubtitlesForFilter();

    videoElement.addEventListener('timeupdate', () => {
        const currentTime = videoElement.currentTime;
        const subtitleText = document.getElementById('subtitleText');

        // Check active filters
        const activeFilter = activeFilters.find(f => currentTime >= f.start && currentTime < f.end);

        if (activeFilter) {
            if (activeFilter.type === 'skip') {
                // Only skip if we are at the start of the skip zone (to avoid infinite loop if we seek into it)
                if (Math.abs(currentTime - activeFilter.start) < 1) {
                    console.log(`Skipping: ${activeFilter.reason}`);
                    videoElement.currentTime = activeFilter.end;
                    showToast(`Skipped: ${activeFilter.reason}`, 'fa-forward');
                }
            }
            else if (activeFilter.type === 'mute') {
                if (!videoElement.muted) {
                    console.log(`Muting: ${activeFilter.reason}`);
                    videoElement.muted = true;
                    subtitleText.innerHTML = '<span class="text-red-500">🔇 [Language Filtered]</span>';
                    subtitleText.style.display = 'inline-block';
                }
            }
        } else {
            // Restore state if we just left a filter zone
            if (videoElement.muted && !playerState.isMuted) {
                videoElement.muted = false;
            }

            // Display regular subtitles
            if (state.currentSubtitles) {
                const currentSub = state.currentSubtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
                if (currentSub) {
                    subtitleText.innerHTML = currentSub.text.replace(/\n/g, '<br>');
                    subtitleText.style.display = 'inline-block';
                    subtitleText.style.color = 'white';
                } else {
                    subtitleText.textContent = '';
                    subtitleText.style.display = 'none';
                }
            }
        }

        // Update UI Progress Bar
        updateProgressBar(videoElement);
    });
}

function updateServerTabs() {
    document.querySelectorAll('.server-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.source === state.currentSource);
    });
}

function playTrailer(youtubeKey) {
    const playerModal = document.getElementById('playerModal');
    const videoFrame = document.getElementById('videoFrame');
    const episodeSelector = document.getElementById('episodeSelector');
    const videoLoading = document.getElementById('videoLoading');

    episodeSelector.classList.add('hidden');
    document.getElementById('playerTitle').textContent = 'Trailer';
    document.getElementById('playerSubtitle').textContent = '';

    videoLoading.classList.remove('hidden');
    videoFrame.src = `https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`;

    videoFrame.onload = () => videoLoading.classList.add('hidden');

    playerModal.classList.remove('hidden');
    playerModal.style.display = '';
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const playerModal = document.getElementById('playerModal');
    const videoFrame = document.getElementById('videoFrame');
    const customVideo = document.getElementById('customVideo');

    // Stop Iframe
    videoFrame.src = '';

    // Stop WebTorrent (browser client)
    if (wtClient) {
        wtClient.torrents.forEach(t => t.destroy());
    }
    if (customVideo) {
        customVideo.pause();
        customVideo.src = '';
        customVideo.load();
    }

    // Stop backend stream if active
    if (state.currentStreamInfoHash && streamingServerAvailable) {
        fetch(`${STREAMING_SERVER_URL}/api/stream/${state.currentStreamInfoHash}`, {
            method: 'DELETE'
        }).catch(() => { }); // Ignore errors
        state.currentStreamInfoHash = null;
    }

    playerModal.classList.add('hidden');
    playerModal.style.display = 'none';
    document.body.style.overflow = '';
}

// ============== NAVIGATION ==============

function showSection(section, event) {
    if (event) event.preventDefault();

    switch (section) {
        case 'home':
            window.location.href = 'index.html';
            break;
        case 'movies':
            window.location.href = 'movies.html';
            break;
        case 'series':
            window.location.href = 'series.html';
            break;
        case 'watchlist':
            window.location.href = 'watchlist.html';
            break;
    }
}

function goHome() {
    window.location.href = 'index.html';
}

// ============== WATCHLIST ==============

function toggleWatchlist(id, mediaType) {
    const index = state.watchlist.findIndex(w => w.id === id);

    if (index > -1) {
        state.watchlist.splice(index, 1);
        showToast('Removed from watchlist', 'fa-minus-circle');
    } else {
        // Fetch basic info and add
        fetchFromTMDB(`/${mediaType}/${id}`).then(data => {
            if (data) {
                state.watchlist.push({
                    id: data.id,
                    title: data.title || data.name,
                    poster: data.poster_path ? `${TMDB_IMAGE}/w342${data.poster_path}` : '',
                    mediaType,
                    rating: data.vote_average,
                    year: (data.release_date || data.first_air_date || '').substring(0, 4)
                });
                localStorage.setItem('cinemahalal_watchlist', JSON.stringify(state.watchlist));
                updateAllWatchlistButtons(id, true);
            }
        });
        showToast('Added to watchlist', 'fa-check-circle');
    }

    localStorage.setItem('cinemahalal_watchlist', JSON.stringify(state.watchlist));
    updateAllWatchlistButtons(id, index === -1);

    // Re-render watchlist if visible
    if (!document.getElementById('watchlistSection').classList.contains('hidden')) {
        renderWatchlist();
    }
}

function updateAllWatchlistButtons(id, isAdded) {
    document.querySelectorAll(`.watchlist-btn[data-id="${id}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (isAdded) {
            btn.classList.add('added');
            if (icon) icon.className = 'fas fa-check';
            if (btn.textContent.includes('Watchlist') || btn.textContent.includes('List')) {
                btn.innerHTML = '<i class="fas fa-check"></i> Added';
            }
        } else {
            btn.classList.remove('added');
            if (icon) icon.className = 'fas fa-plus';
            if (btn.textContent.includes('Added') || btn.textContent.includes('List')) {
                btn.innerHTML = '<i class="fas fa-plus"></i> Watchlist';
            }
        }
    });
}

function renderWatchlist() {
    const container = document.getElementById('watchlistGrid');
    const emptyState = document.getElementById('emptyWatchlist');
    const countEl = document.getElementById('watchlistCount');

    countEl.textContent = `(${state.watchlist.length} items)`;

    if (state.watchlist.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        container.innerHTML = state.watchlist.map(item => `
            <div class="movie-card" onclick="showDetails(${item.id}, '${item.mediaType}')" data-id="${item.id}">
                <div class="relative">
                    <img src="${item.poster || 'https://placehold.co/342x513/1f2937/6b7280?text=No+Image'}" 
                         alt="${escapeHtml(item.title)}" class="movie-poster"
                         onerror="handleImageFallback(this)">
                    
                    <!-- Remove Button -->
                    <button onclick="event.stopPropagation(); toggleWatchlist(${item.id}, '${item.mediaType}')" 
                            class="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition z-10">
                        <i class="fas fa-times text-sm"></i>
                    </button>
                    
                    <div class="movie-overlay">
                        <div class="absolute bottom-0 left-0 right-0 p-3 movie-actions">
                            <button onclick="event.stopPropagation(); playContent(${item.id}, '${item.mediaType}', '${escapeHtml(item.title)}')" 
                                    class="w-full bg-emerald-500 hover:bg-emerald-600 py-2 rounded-lg font-semibold text-sm transition">
                                <i class="fas fa-play mr-1"></i> Play
                            </button>
                        </div>
                    </div>
                    
                    <div class="absolute top-2 left-2">
                        <span class="${item.mediaType === 'tv' ? 'badge-series' : 'badge-movie'} text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            ${item.mediaType === 'tv' ? 'Series' : 'Movie'}
                        </span>
                    </div>
                </div>
                <div class="card-info">
                    <h3 class="card-title">${item.title}</h3>
                    <div class="card-meta">
                        <span>${item.year || ''}</span>
                        <span class="text-yellow-500"><i class="fas fa-star text-[10px]"></i> ${item.rating?.toFixed(1) || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// ============== SEARCH ==============

let searchTimeout;

function handleSearch(event) {
    const query = event.target.value.trim();

    // Handle Enter key
    if (event.key === 'Enter' && query.length > 0) {
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        return;
    }

    clearTimeout(searchTimeout);
    const resultsDiv = document.getElementById('searchResults');

    if (query.length < 2) {
        resultsDiv.classList.add('hidden');
        return;
    }

    searchTimeout = setTimeout(async () => {
        const results = await searchContent(query);

        if (results.length === 0) {
            resultsDiv.innerHTML = `
                <div class="p-4 text-center text-gray-400">
                    <i class="fas fa-search mb-2"></i>
                    <p>No results for "${query}"</p>
                </div>
            `;
        } else {
            resultsDiv.innerHTML = `
                <div class="p-2">
                    ${results.slice(0, 5).map(item => {
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').substring(0, 4);
                const poster = item.poster_path ? `${TMDB_IMAGE}/w92${item.poster_path}` : 'https://placehold.co/92x138/1f2937/6b7280?text=N/A';
                const type = item.media_type;

                return `
                            <div onclick="showDetails(${item.id}, '${type}'); document.getElementById('searchResults').classList.add('hidden');" 
                                 class="flex items-center gap-3 p-2 hover:bg-gray-700 rounded-lg cursor-pointer transition">
                                <img src="${poster}" alt="" class="w-12 h-16 object-cover rounded" onerror="handleImageFallback(this)">
                                <div class="flex-1 min-w-0">
                                    <p class="font-medium truncate">${title}</p>
                                    <div class="flex items-center gap-2 text-sm text-gray-400">
                                        <span class="${type === 'tv' ? 'text-purple-400' : 'text-blue-400'}">${type === 'tv' ? 'Series' : 'Movie'}</span>
                                        <span>${year}</span>
                                    </div>
                                </div>
                                <button onclick="event.stopPropagation(); playContent(${item.id}, '${type}', '${escapeHtml(title)}')" 
                                        class="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center transition">
                                    <i class="fas fa-play text-sm"></i>
                                </button>
                            </div>
                        `;
            }).join('')}
                    
                    <!-- View All Results Link -->
                    <div onclick="window.location.href='search.html?q=${encodeURIComponent(query)}'" 
                         class="p-3 text-center border-t border-gray-700 text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium transition hover:bg-gray-700/50 rounded-b-lg">
                        View all results for "${escapeHtml(query)}" <i class="fas fa-arrow-right ml-1"></i>
                    </div>
                </div>
            `;
        }

        resultsDiv.classList.remove('hidden');
    }, 300);
}

// ============== SETTINGS ==============

function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
    document.body.style.overflow = '';
}

function loadSettings() {
    const settings = state.settings;

    // UI Elements
    const elements = {
        defaultServer: document.getElementById('defaultServer'),
        defaultSubtitle: document.getElementById('defaultSubtitle'),
        cfHideAdult: document.getElementById('cfHideAdult'),
        cfHideHorror: document.getElementById('cfHideHorror'),
        cfHideCrime: document.getElementById('cfHideCrime'),
        cfMinRating: document.getElementById('cfMinRating'),
        settingsProfanityFilter: document.getElementById('settingsProfanityFilter'),
        settingsSubFontSize: document.getElementById('settingsSubFontSize'),
        settingsSubBgOpacity: document.getElementById('settingsSubBgOpacity')
    };

    // Map settings to UI
    if (elements.defaultServer) elements.defaultServer.value = settings.defaultServer || 'webtorrent';
    if (elements.defaultSubtitle) elements.defaultSubtitle.value = settings.defaultSubtitle || 'en';
    if (elements.cfHideAdult) elements.cfHideAdult.checked = settings.cfHideAdult ?? true;
    if (elements.cfHideHorror) elements.cfHideHorror.checked = settings.cfHideHorror ?? true;
    if (elements.cfHideCrime) elements.cfHideCrime.checked = settings.cfHideCrime ?? false;
    if (elements.cfMinRating) {
        elements.cfMinRating.value = settings.cfMinRating || 0;
        updateRatingLabel();
    }
    if (elements.settingsProfanityFilter) elements.settingsProfanityFilter.checked = settings.profanityFilter ?? true;
    if (elements.settingsSubFontSize) elements.settingsSubFontSize.value = settings.subtitleFontSize || 20;
    if (elements.settingsSubBgOpacity) elements.settingsSubBgOpacity.value = settings.subtitleBgOpacity || 80;

    // Update global state source
    state.currentSource = settings.defaultServer || 'webtorrent';

    updateFamilyModeUI();
}

function updateRatingLabel() {
    const slider = document.getElementById('cfMinRating');
    const label = document.getElementById('minRatingLabel');
    if (slider && label) {
        label.textContent = `${slider.value}/10`;
    }
}

function saveSettings() {
    state.settings = {
        defaultServer: document.getElementById('defaultServer')?.value || 'webtorrent',
        defaultSubtitle: document.getElementById('defaultSubtitle')?.value || 'en',
        cfHideAdult: document.getElementById('cfHideAdult')?.checked,
        cfHideHorror: document.getElementById('cfHideHorror')?.checked,
        cfHideCrime: document.getElementById('cfHideCrime')?.checked,
        cfMinRating: parseFloat(document.getElementById('cfMinRating')?.value || 0),
        profanityFilter: document.getElementById('settingsProfanityFilter')?.checked,
        subtitleFontSize: parseInt(document.getElementById('settingsSubFontSize')?.value || 20),
        subtitleBgOpacity: parseInt(document.getElementById('settingsSubBgOpacity')?.value || 80)
    };

    localStorage.setItem('cinemahalal_settings', JSON.stringify(state.settings));

    // Apply changes locally
    if (state.currentSource !== state.settings.defaultServer) {
        state.currentSource = state.settings.defaultServer;
    }

    // If subtitles are open, update style
    if (typeof updateSubtitleStyle === 'function') updateSubtitleStyle();

    showToast('Settings saved', 'fa-check-circle');
}

function toggleFamilyMode() {
    state.familyMode = !state.familyMode;
    localStorage.setItem('familyMode', JSON.stringify(state.familyMode));
    updateFamilyModeUI();
    showToast(state.familyMode ? 'Family Mode enabled' : 'Family Mode disabled', 'fa-shield-alt');

    // Reload content
    initializeApp();
}

function updateFamilyModeUI() {
    ['familyToggle', 'settingsFamilyToggle'].forEach(id => {
        const toggle = document.getElementById(id);
        if (!toggle) return;

        if (state.familyMode) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    });
}

function switchSettingsTab(tabId) {
    state.activeSettingsTab = tabId;

    // Update nav items
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Update content sections
    document.querySelectorAll('.settings-section-content').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(`section-${tabId}`).classList.remove('hidden');
}

// Global functions for new settings UI
window.openSettings = function () {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('hidden');
        loadSettings(); // Refresh UI with current state
    }
};

window.closeSettings = function () {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.switchSettingsTab = switchSettingsTab;

// ============== UTILITIES ==============

function scrollContainer(button, direction) {
    const container = button.parentElement.querySelector('.overflow-x-auto');
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    const sections = document.getElementById('contentSections');

    if (show) {
        loader?.classList.remove('hidden');
        sections?.classList.add('hidden');
    } else {
        loader?.classList.add('hidden');
        sections?.classList.remove('hidden');
    }
}

function showToast(message, icon = 'fa-check-circle') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMessage.textContent = message;
    toastIcon.className = `fas ${icon} text-emerald-500 text-xl`;

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showStreamError(title, details) {
    const streamError = document.getElementById('streamError');
    if (!streamError) {
        // Fallback if overlay is missing
        showToast(title, 'fa-exclamation-circle');
        return;
    }

    const titleEl = document.getElementById('streamErrorTitle');
    const detailsEl = document.getElementById('streamErrorDetails');
    if (titleEl) titleEl.textContent = title || 'Streaming error';
    if (detailsEl) detailsEl.textContent = details || '';

    streamError.classList.remove('hidden');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ============== EVENT LISTENERS ==============

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePlayer();
        closeModal();
        closeSettings();
        document.getElementById('searchResults').classList.add('hidden');
    }

    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const playerOpen = !document.getElementById('playerModal').classList.contains('hidden');
        if (!playerOpen) {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    }
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('#searchInput').parentElement;
    if (searchContainer && !searchContainer.contains(e.target)) {
        document.getElementById('searchResults').classList.add('hidden');
    }
});

console.log('CinemaHalal App Loaded!');

// ============== MOBILE MENU ==============

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        // Small delay to allow display:block to apply before transition
        setTimeout(() => {
            menu.classList.remove('scale-y-0', 'opacity-0');
        }, 10);
    } else {
        menu.classList.add('scale-y-0', 'opacity-0');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300); // Match transition duration
    }
}

// Close mobile menu when resizing to desktop
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) { // md breakpoint
        const menu = document.getElementById('mobileMenu');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden', 'scale-y-0', 'opacity-0');
        }
    }
});

// Ensure toggleUserMenu exists (if not defined elsewhere)
if (typeof window.toggleUserMenu === 'undefined') {
    window.toggleUserMenu = function () {
        const menu = document.getElementById('userMenu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    };

    // Close user menu when clicking outside
    document.addEventListener('click', (e) => {
        const userBtn = document.getElementById('userButton');
        const userMenu = document.getElementById('userMenu');
        if (userBtn && userMenu && !userBtn.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
    });
}

