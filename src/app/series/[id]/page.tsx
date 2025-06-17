'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import tmdbAPI, { TMDBSeries, getTMDBImageUrl } from '../../../services/tmdb';

export default function SeriesDetailPage() {
  const params = useParams();
  const seriesId = params.id as string;
  
  const [series, setSeries] = useState<TMDBSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchSeriesDetails = async () => {
      try {
        const seriesData = await tmdbAPI.series.getDetail(Number(seriesId));
        setSeries(seriesData);
      } catch (err: any) {
        setError(err.message || 'Failed to load series details');
      } finally {
        setLoading(false);
      }
    };
    
    if (seriesId) {
      fetchSeriesDetails();
    }
  }, [seriesId]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !series) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded">
        <h2 className="text-xl font-bold">Error</h2>
        <p>{error || 'Series not found'}</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="relative">
        {/* Backdrop Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent opacity-90"></div>
          <img 
            src={getTMDBImageUrl(series.backdrop_path, 'original')}
            alt={series.name}
            className="w-full h-[400px] object-cover"
          />
        </div>
        
        {/* Series Info */}
        <div className="relative z-10 flex flex-col md:flex-row items-start py-8 px-4">
          <div className="md:w-1/3 mb-6 md:mb-0">
            <img 
              src={getTMDBImageUrl(series.poster_path, 'w500')}
              alt={series.name}
              className="w-72 rounded-lg shadow-lg mx-auto md:mx-0"
            />
          </div>
          
          <div className="md:w-2/3 md:pl-8 text-white">
            <h1 className="text-4xl font-bold mb-2">{series.name}</h1>
            
            <div className="mb-4 flex flex-wrap items-center">
              <span className="bg-yellow-500 text-black px-2 py-1 rounded mr-2 font-bold">
                {series.vote_average.toFixed(1)}
              </span>
              <span className="mr-4">({series.vote_count} votes)</span>
              <span>{new Date(series.first_air_date).getFullYear()}</span>
              {series.number_of_seasons && (
                <span className="ml-4">{series.number_of_seasons} {series.number_of_seasons === 1 ? 'Season' : 'Seasons'}</span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {series.genres?.map(genre => (
                <span 
                  key={genre.id}
                  className="px-3 py-1 bg-gray-700 text-white rounded-full text-sm"
                >
                  {genre.name}
                </span>
              ))}
            </div>
            
            <p className="text-lg mb-6">{series.overview}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-400">First Air Date</h3>
                <p>{new Date(series.first_air_date).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-400">Status</h3>
                <p>Ongoing</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-400">Language</h3>
                <p>{series.original_language.toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Seasons List */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Seasons</h2>
        
        <div className="space-y-4">
          {Array.isArray(series.seasons) && series.seasons.map((season: any) => (
            <div key={season.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/6">
                  <img 
                    src={getTMDBImageUrl(season.poster_path, 'w300')} 
                    alt={season.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/series/${series.id}/season/${season.season_number}`} className="text-xl font-semibold hover:text-blue-600">
                        {season.name}
                      </Link>
                      <div className="text-sm text-gray-500">
                        {season.episode_count} Episodes · {season.air_date ? new Date(season.air_date).getFullYear() : 'TBA'}
                      </div>
                    </div>
                    <Link href={`/series/${series.id}/season/${season.season_number}`} className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded">
                      View Episodes
                    </Link>
                  </div>
                  {season.overview && (
                    <p className="mt-4 text-gray-700">{season.overview}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}