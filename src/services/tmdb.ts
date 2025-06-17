import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const fetchMovieMetadata = async (movieId) => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching movie metadata:', error);
        throw error;
    }
};

export const fetchTrendingMovies = async () => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/trending/movie/week`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
            },
        });
        return response.data.results;
    } catch (error) {
        console.error('Error fetching trending movies:', error);
        throw error;
    }
};

export const fetchMovieGenres = async () => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
            },
        });
        return response.data.genres;
    } catch (error) {
        console.error('Error fetching movie genres:', error);
        throw error;
    }
};