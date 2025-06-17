'use client';

import React, { useEffect, useState } from 'react';
import tmdbAPI, { TMDBMovie, getTMDBImageUrl } from '../../services/tmdb';
import Link from 'next/link';

export default function MoviesPage() {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const popularMovies = await tmdbAPI.movie.getPopular();
        setMovies(popularMovies.results);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch movies');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMovies();
  }, []);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded">
        <h2 className="text-xl font-bold">Error</h2>
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Popular Movies</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {movies.map((movie) => (
          <Link href={`/movies/${movie.id}`} key={movie.id}>
            <div className="movie-card bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105">
              <div className="relative pb-[150%]">
                <img 
                  src={getTMDBImageUrl(movie.poster_path, 'w500')} 
                  alt={movie.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-lg truncate">{movie.title}</h2>
                <div className="flex items-center mt-2">
                  <span className="text-yellow-500">★</span>
                  <span className="ml-1">{movie.vote_average.toFixed(1)}</span>
                  <span className="ml-2 text-sm text-gray-500">({movie.vote_count})</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(movie.release_date).getFullYear()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}