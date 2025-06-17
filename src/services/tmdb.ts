import axios from 'axios';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = process.env.NEXT_PUBLIC_TMDB_API_URL || 'https://api.themoviedb.org/3';

// Types for TMDB responses
export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  runtime?: number;
  genres?: { id: number; name: string }[];
  genre_ids?: number[];
  popularity: number;
  original_language: string;
  adult: boolean;
  video?: boolean;
}

export interface TMDBSeries {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string;
  genres?: { id: number; name: string }[];
  genre_ids?: number[];
  origin_country: string[];
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time?: number[];
}

export interface TMDBSeason {
  id: number;
  air_date: string;
  episode_count: number;
  name: string;
  overview: string;
  poster_path: string;
  season_number: number;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  air_date: string;
  episode_number: number;
  season_number: number;
  still_path: string;
  vote_average: number;
  vote_count: number;
  runtime?: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

// The base API client
const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  params: {
    api_key: TMDB_API_KEY,
  },
});

// Handle API errors
const handleError = (error: any, message: string) => {
  console.error(`${message}:`, error);
  throw error;
};

// Movies API
export const movieAPI = {
  // Get trending movies
  getTrending: async (timeWindow: 'day' | 'week' = 'week'): Promise<TMDBMovie[]> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>(`/trending/movie/${timeWindow}`);
      return response.data.results;
    } catch (error) {
      return handleError(error, 'Error fetching trending movies');
    }
  },

  // Get details for a specific movie
  getDetail: async (id: number): Promise<TMDBMovie> => {
    try {
      const response = await tmdbClient.get<TMDBMovie>(`/movie/${id}`, {
        params: {
          append_to_response: 'credits,videos,images,recommendations',
        },
      });
      return response.data;
    } catch (error) {
      return handleError(error, `Error fetching movie ${id} details`);
    }
  },

  // Get videos for a movie
  getVideos: async (id: number): Promise<TMDBVideo[]> => {
    try {
      const response = await tmdbClient.get<{ results: TMDBVideo[] }>(`/movie/${id}/videos`);
      return response.data.results;
    } catch (error) {
      return handleError(error, `Error fetching videos for movie ${id}`);
    }
  },

  // Search movies by keyword
  search: async (query: string, page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>('/search/movie', {
        params: { query, page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, `Error searching movies for "${query}"`);
    }
  },

  // Get popular movies
  getPopular: async (page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>('/movie/popular', {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, 'Error fetching popular movies');
    }
  },

  // Get now playing movies (in theaters)
  getNowPlaying: async (page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>('/movie/now_playing', {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, 'Error fetching now playing movies');
    }
  },

  // Get top rated movies
  getTopRated: async (page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>('/movie/top_rated', {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, 'Error fetching top rated movies');
    }
  },

  // Get upcoming movies
  getUpcoming: async (page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>('/movie/upcoming', {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, 'Error fetching upcoming movies');
    }
  },

  // Get recommendations for a movie
  getRecommendations: async (id: number, page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>(`/movie/${id}/recommendations`, {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, `Error fetching recommendations for movie ${id}`);
    }
  },

  // Get movies by genre
  getByGenre: async (genreId: number, page: number = 1): Promise<TMDBPaginatedResponse<TMDBMovie>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBMovie>>('/discover/movie', {
        params: {
          with_genres: genreId,
          page,
        },
      });
      return response.data;
    } catch (error) {
      return handleError(error, `Error fetching movies for genre ${genreId}`);
    }
  },
};

// TV Series API
export const seriesAPI = {
  // Get trending TV series
  getTrending: async (timeWindow: 'day' | 'week' = 'week'): Promise<TMDBSeries[]> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBSeries>>(`/trending/tv/${timeWindow}`);
      return response.data.results;
    } catch (error) {
      return handleError(error, 'Error fetching trending series');
    }
  },

  // Get details for a specific TV series
  getDetail: async (id: number): Promise<TMDBSeries> => {
    try {
      const response = await tmdbClient.get<TMDBSeries>(`/tv/${id}`, {
        params: {
          append_to_response: 'credits,videos,images,recommendations,seasons',
        },
      });
      return response.data;
    } catch (error) {
      return handleError(error, `Error fetching series ${id} details`);
    }
  },

  // Get season details for a TV series
  getSeason: async (id: number, seasonNumber: number): Promise<TMDBSeason & { episodes: TMDBEpisode[] }> => {
    try {
      const response = await tmdbClient.get(`/tv/${id}/season/${seasonNumber}`);
      return response.data;
    } catch (error) {
      return handleError(error, `Error fetching season ${seasonNumber} for series ${id}`);
    }
  },

  // Get episode details
  getEpisode: async (id: number, seasonNumber: number, episodeNumber: number): Promise<TMDBEpisode> => {
    try {
      const response = await tmdbClient.get(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`);
      return response.data;
    } catch (error) {
      return handleError(error, `Error fetching episode ${episodeNumber} of season ${seasonNumber} for series ${id}`);
    }
  },

  // Search TV series by keyword
  search: async (query: string, page: number = 1): Promise<TMDBPaginatedResponse<TMDBSeries>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBSeries>>('/search/tv', {
        params: { query, page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, `Error searching TV series for "${query}"`);
    }
  },

  // Get popular TV series
  getPopular: async (page: number = 1): Promise<TMDBPaginatedResponse<TMDBSeries>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBSeries>>('/tv/popular', {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, 'Error fetching popular TV series');
    }
  },

  // Get top rated TV series
  getTopRated: async (page: number = 1): Promise<TMDBPaginatedResponse<TMDBSeries>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBSeries>>('/tv/top_rated', {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, 'Error fetching top rated TV series');
    }
  },

  // Get currently airing TV series
  getOnTheAir: async (page: number = 1): Promise<TMDBPaginatedResponse<TMDBSeries>> => {
    try {
      const response = await tmdbClient.get<TMDBPaginatedResponse<TMDBSeries>>('/tv/on_the_air', {
        params: { page },
      });
      return response.data;
    } catch (error) {
      return handleError(error, 'Error fetching currently airing TV series');
    }
  },
};

// Genres API
export const genreAPI = {
  // Get movie genres
  getMovieGenres: async (): Promise<TMDBGenre[]> => {
    try {
      const response = await tmdbClient.get<{ genres: TMDBGenre[] }>('/genre/movie/list');
      return response.data.genres;
    } catch (error) {
      return handleError(error, 'Error fetching movie genres');
    }
  },

  // Get TV series genres
  getTVGenres: async (): Promise<TMDBGenre[]> => {
    try {
      const response = await tmdbClient.get<{ genres: TMDBGenre[] }>('/genre/tv/list');
      return response.data.genres;
    } catch (error) {
      return handleError(error, 'Error fetching TV genres');
    }
  },
};

// Helper functions
export const getTMDBImageUrl = (path: string | null, size: 'original' | 'w500' | 'w300' | 'w185' = 'original'): string => {
  if (!path) return '/placeholder-image.jpg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export default {
  movie: movieAPI,
  series: seriesAPI,
  genre: genreAPI,
  getImageUrl: getTMDBImageUrl,
};