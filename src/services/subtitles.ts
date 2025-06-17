import axios from 'axios';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Types for subtitle API responses
export interface Subtitle {
  id: string;
  movieName: string;
  language: string;
  format: 'srt' | 'vtt';
  fileName: string;
  downloadUrl: string;
  uploadedBy?: string;
  uploadedAt?: Date;
  rating?: number;
  downloads?: number;
  fileSize?: number;
}

// OpenSubtitles.com API (requires API key and authentication)
const OPENSUBTITLES_API_URL = 'https://api.opensubtitles.com/api/v1';
const OPENSUBTITLES_API_KEY = process.env.NEXT_PUBLIC_OPENSUBTITLES_API_KEY;

// Helper for OpenSubtitles API
const openSubtitlesClient = axios.create({
  baseURL: OPENSUBTITLES_API_URL,
  headers: {
    'Api-Key': OPENSUBTITLES_API_KEY,
    'Content-Type': 'application/json',
  },
});

/**
 * Search for subtitles by IMDB ID or movie/series title
 */
export const searchSubtitles = async ({
  imdbId,
  title,
  type = 'movie',
  language = 'ar',
  season,
  episode,
}: {
  imdbId?: string;
  title?: string;
  type?: 'movie' | 'episode';
  language?: string;
  season?: number;
  episode?: number;
}): Promise<Subtitle[]> => {
  try {
    const params: any = {
      languages: language,
    };

    if (imdbId) {
      params.imdb_id = imdbId;
    } else if (title) {
      params.query = title;
    } else {
      throw new Error('Either imdbId or title must be provided');
    }

    if (type === 'episode' && season && episode) {
      params.season_number = season;
      params.episode_number = episode;
    }

    const response = await openSubtitlesClient.get('/subtitles', { params });

    // Map response to our interface
    return response.data.data.map((item: any): Subtitle => ({
      id: item.id,
      movieName: item.attributes.feature_details.movie_name,
      language: item.attributes.language,
      format: item.attributes.format,
      fileName: item.attributes.files[0]?.file_name || '',
      downloadUrl: '',  // Requires another API call with authentication
      uploadedBy: item.attributes.uploader.name,
      uploadedAt: new Date(item.attributes.upload_date),
      fileSize: item.attributes.files[0]?.file_size || 0,
      downloads: item.attributes.download_count,
      rating: item.attributes.ratings,
    }));
  } catch (error) {
    console.error('Error searching for subtitles:', error);
    return [];
  }
};

/**
 * Download a subtitle by ID
 * Note: This requires authentication in the real OpenSubtitles API
 */
export const downloadOpenSubtitles = async (subtitleId: string): Promise<string> => {
  try {
    // In a real implementation, this would make an authenticated request
    // to download the subtitle file
    const response = await openSubtitlesClient.post('/download', {
      subtitle_id: subtitleId
    });

    // The response would include the download URL
    const downloadUrl = response.data.link;
    return downloadUrl;
  } catch (error) {
    console.error('Error downloading subtitle:', error);
    throw error;
  }
};

/**
 * Convert SRT subtitle format to VTT
 */
export const convertSrtToVtt = (srtContent: string): string => {
  // Add the WEBVTT header
  let vttContent = 'WEBVTT\n\n';

  // Replace commas with dots in timestamps
  vttContent += srtContent
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4')
    // Remove subtitle numbers
    .replace(/^(\d+)(\r?\n)/gm, '')
    // Add additional line break between entries
    .replace(/\r?\n\r?\n/g, '\n\n');

  return vttContent;
};

/**
 * Upload a subtitle file to Firebase Storage
 */
export const uploadSubtitleFile = async (
  file: File,
  contentId: string,
  language: string = 'ar'
): Promise<string> => {
  try {
    // Create a reference to the subtitle file in Firebase Storage
    const subtitleRef = ref(
      storage,
      `subtitles/${contentId}/${language}/${file.name}`
    );

    // Upload the file
    await uploadBytes(subtitleRef, file);

    // Get the download URL
    const downloadUrl = await getDownloadURL(subtitleRef);
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading subtitle file:', error);
    throw error;
  }
};

/**
 * Parse SRT file content to a structured format
 */
export const parseSrt = (srtContent: string): Array<{id: number, start: number, end: number, text: string}> => {
  const subtitles: Array<{id: number, start: number, end: number, text: string}> = [];
  
  // Split the content by double newline (subtitle separator)
  const subtitleBlocks = srtContent.trim().split(/\r?\n\r?\n/);
  
  for (const block of subtitleBlocks) {
    const lines = block.split(/\r?\n/);
    
    if (lines.length < 3) continue;
    
    // First line is the subtitle ID
    const id = parseInt(lines[0], 10);
    
    // Second line is the timestamp
    const timestamps = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    
    if (!timestamps) continue;
    
    // Convert timestamp to seconds
    const startHours = parseInt(timestamps[1], 10);
    const startMinutes = parseInt(timestamps[2], 10);
    const startSeconds = parseInt(timestamps[3], 10);
    const startMilliseconds = parseInt(timestamps[4], 10);
    
    const endHours = parseInt(timestamps[5], 10);
    const endMinutes = parseInt(timestamps[6], 10);
    const endSeconds = parseInt(timestamps[7], 10);
    const endMilliseconds = parseInt(timestamps[8], 10);
    
    const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
    const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
    
    // The rest of the lines are the text
    const text = lines.slice(2).join(' ');
    
    subtitles.push({ id, start, end, text });
  }
  
  return subtitles;
};

export default {
  searchSubtitles,
  downloadOpenSubtitles,
  convertSrtToVtt,
  uploadSubtitleFile,
  parseSrt,
};