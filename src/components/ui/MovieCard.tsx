import React from 'react';

interface MovieCardProps {
    title: string;
    year: number;
    poster: string;
    rating: number;
    onClick: () => void;
}

const MovieCard: React.FC<MovieCardProps> = ({ title, year, poster, rating, onClick }) => {
    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer" onClick={onClick}>
            <img src={poster} alt={title} className="w-full h-48 object-cover" />
            <div className="p-4">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-gray-600">{year}</p>
                <p className="text-yellow-500">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</p>
            </div>
        </div>
    );
};

export default MovieCard;