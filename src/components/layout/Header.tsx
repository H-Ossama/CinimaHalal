import React from 'react';

const Header: React.FC = () => {
    return (
        <header className="bg-gray-800 text-white p-4">
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-2xl font-bold">Clean Stream</h1>
                <nav>
                    <ul className="flex space-x-4">
                        <li><a href="/" className="hover:underline">Home</a></li>
                        <li><a href="/movies" className="hover:underline">Movies</a></li>
                        <li><a href="/series" className="hover:underline">Series</a></li>
                        <li><a href="/login" className="hover:underline">Login</a></li>
                        <li><a href="/signup" className="hover:underline">Sign Up</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    );
};

export default Header;