import axios from 'axios';

const OPEN_SUBTITLES_API_URL = 'https://api.opensubtitles.org/xml-rpc';
const SUBSCENE_URL = 'https://subscene.com/subtitles/title?q=';

export const fetchSubtitlesByMovieName = async (movieName) => {
    try {
        const response = await axios.get(`${SUBSCENE_URL}${encodeURIComponent(movieName)}`);
        // Parse the response to extract subtitle links
        const subtitles = parseSubsceneResponse(response.data);
        return subtitles;
    } catch (error) {
        console.error('Error fetching subtitles:', error);
        throw error;
    }
};

const parseSubsceneResponse = (data) => {
    // Implement parsing logic to extract subtitle links from the response
    // This is a placeholder for actual parsing logic
    return [];
};

export const downloadSubtitle = async (subtitleUrl) => {
    try {
        const response = await axios.get(subtitleUrl, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'text/srt' });
        const url = window.URL.createObjectURL(blob);
        return url;
    } catch (error) {
        console.error('Error downloading subtitle:', error);
        throw error;
    }
};