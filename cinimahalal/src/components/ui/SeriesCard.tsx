import React from 'react';

interface SeriesCardProps {
  title: string;
  poster: string;
  year: number;
  seasons: number;
  onClick: () => void;
}

const SeriesCard: React.FC<SeriesCardProps> = ({ title, poster, year, seasons, onClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer" onClick={onClick}>
      <img src={poster} alt={`${title} poster`} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-gray-600">{year}</p>
        <p className="text-gray-500">{seasons} Season{seasons > 1 ? 's' : ''}</p>
      </div>
    </div>
  );
};

export default SeriesCard;