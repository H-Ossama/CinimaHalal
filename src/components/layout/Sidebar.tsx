import React from 'react';

const Sidebar: React.FC = () => {
    return (
        <div className="w-64 bg-gray-800 text-white h-full p-4">
            <h2 className="text-xl font-bold mb-4">Navigation</h2>
            <ul>
                <li className="mb-2">
                    <a href="/" className="hover:text-gray-400">Home</a>
                </li>
                <li className="mb-2">
                    <a href="/movies" className="hover:text-gray-400">Movies</a>
                </li>
                <li className="mb-2">
                    <a href="/series" className="hover:text-gray-400">Series</a>
                </li>
                <li className="mb-2">
                    <a href="/login" className="hover:text-gray-400">Login</a>
                </li>
                <li className="mb-2">
                    <a href="/signup" className="hover:text-gray-400">Sign Up</a>
                </li>
            </ul>
        </div>
    );
};

export default Sidebar;