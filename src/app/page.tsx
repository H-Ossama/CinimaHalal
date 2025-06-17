import React from 'react';

const HomePage = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome to CinemaHalal</h1>
      <p className="mt-2">Your go-to platform for streaming movies and series with enhanced filtering options.</p>
      
      {/* Featured content section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Featured Content</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Movie cards will be added here */}
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Movie Card 1
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Movie Card 2
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Movie Card 3
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Movie Card 4
          </div>
        </div>
      </div>
      
      {/* Latest Movies section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Latest Movies</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Movie cards will be added here */}
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Latest Movie 1
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Latest Movie 2
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Latest Movie 3
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Latest Movie 4
          </div>
        </div>
      </div>
      
      {/* Popular Series section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Popular Series</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Series cards will be added here */}
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Series 1
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Series 2
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Series 3
          </div>
          <div className="bg-gray-200 p-4 rounded-lg h-64 flex items-center justify-center">
            Series 4
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;