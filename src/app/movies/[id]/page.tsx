'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import VideoPlayer from '../../../components/player/VideoPlayer';
import FilterControls, { FilterType } from '../../../components/player/FilterControls';
import usePlayer from '../../../hooks/usePlayer';
import useFilters from '../../../hooks/useFilters';
import tmdbAPI, { TMDBMovie, getTMDBImageUrl } from '../../../services/tmdb';
import { useAuthContext } from '../../../context/AuthContext';

export default function MovieDetailPage() {
  const params = useParams();
  const movieId = params.id as string;
  const { user } = useAuthContext();
  
  // State for movie data
  const [movie, setMovie] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Video player container ref
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  // Get filters for this movie
  const { 
    filters, 
    enabledFilterIds, 
    toggleFilter, 
    saveUserPreferences, 
    updateFilterIntensity 
  } = useFilters({ 
    contentId: movieId 
  });
  
  // Format filters for FilterControls component
  const formattedFilters: FilterType[] = filters.map(filter => ({
    id: filter.id,
    type: filter.type,
    label: filter.category ? `${filter.category} (${filter.type})` : filter.type,
    description: filter.description || `${filter.type} content from ${filter.startTime}s to ${filter.endTime}s`,
    enabled: enabledFilterIds.includes(filter.id),
    intensity: filter.intensity,
    categories: filter.category ? [filter.category] : undefined
  }));
  
  // Configure video player
  const playerOptions = {
    contentId: movieId,
    sources: movie ? [
      {
        src: `https://www.example.com/videos/${movieId}.mp4`, // Placeholder URL
        type: 'video/mp4'
      }
    ] : [],
    poster: movie ? getTMDBImageUrl(movie.backdrop_path, 'w500') : undefined,
    subtitles: [
      {
        src: `/api/subtitles/${movieId}/en`,
        kind: 'subtitles',
        srclang: 'en',
        label: 'English',
        default: true
      },
      {
        src: `/api/subtitles/${movieId}/ar`,
        kind: 'subtitles',
        srclang: 'ar',
        label: 'Arabic'
      }
    ]
  };
  
  const { 
    handlePlayerReady, 
    isPlaying, 
    currentTime, 
    togglePlay, 
    toggleFullscreen 
  } = usePlayer(playerOptions);
  
  // Fetch movie data from TMDB
  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        setLoading(true);
        const movieData = await tmdbAPI.movie.getDetail(Number(movieId));
        setMovie(movieData);
      } catch (err: any) {
        setError(err.message || 'Failed to load movie details');
      } finally {
        setLoading(false);
      }
    };
    
    if (movieId) {
      fetchMovieData();
    }
  }, [movieId]);
  
  // Handle filter toggle
  const handleToggleFilter = (filterId: string) => {
    toggleFilter(filterId);
  };
  
  // Handle filter intensity change
  const handleIntensityChange = (filterId: string, intensity: number) => {
    updateFilterIntensity(filterId, intensity);
  };
  
  // Save user preferences
  const handleSavePreset = async () => {
    if (user) {
      await saveUserPreferences();
      alert('Preferences saved successfully!');
    } else {
      alert('You need to be logged in to save preferences');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !movie) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded">
        <h2 className="text-xl font-bold">Error</h2>
        <p>{error || 'Movie not found'}</p>
      </div>
    );
  }
  
  return (
    <div className="movie-detail-page max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{movie.title}</h1>
      
      {/* Video Player */}
      <div className="mb-6">
        <div 
          ref={playerContainerRef}
          className="relative aspect-video bg-black rounded-lg overflow-hidden"
        >
          <VideoPlayer
            sources={playerOptions.sources}
            poster={playerOptions.poster}
            subtitles={playerOptions.subtitles}
            filters={filters
              .filter(f => enabledFilterIds.includes(f.id))
              .map(f => ({
                start: f.startTime,
                end: f.endTime,
                type: f.type,
              }))}
            onReady={handlePlayerReady}
            className="w-full h-full"
          />
        </div>
      </div>
      
      {/* Filter Controls */}
      <div className="mb-8">
        <FilterControls
          filters={formattedFilters}
          onToggleFilter={handleToggleFilter}
          onChangeIntensity={handleIntensityChange}
          onSavePreset={handleSavePreset}
          className="mt-4"
        />
      </div>
      
      {/* Movie Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <h2 className="text-2xl font-semibold mb-2">Overview</h2>
          <p className="text-gray-700 mb-4">{movie.overview}</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {movie.genres?.map(genre => (
              <span 
                key={genre.id}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm"
              >
                {genre.name}
              </span>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900">Release Date</h3>
              <p>{new Date(movie.release_date).toLocaleDateString()}</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Rating</h3>
              <p>{movie.vote_average} / 10 ({movie.vote_count} votes)</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Runtime</h3>
              <p>{movie.runtime} minutes</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Language</h3>
              <p>{movie.original_language.toUpperCase()}</p>
            </div>
          </div>
        </div>
        
        <div>
          <img 
            src={getTMDBImageUrl(movie.poster_path, 'w500')} 
            alt={movie.title}
            className="w-full rounded-lg shadow-lg"
          />
        </div>
      </div>
      
      {/* Comments section could be added here */}
    </div>
  );
}