'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthContext } from '../../context/AuthContext';

const Header: React.FC = () => {
    const { user, userProfile, logout, loading } = useAuthContext();

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <header className="bg-gray-800 text-white p-4 sticky top-0 z-10">
            <div className="container mx-auto flex justify-between items-center">
                <Link href="/" className="text-2xl font-bold hover:text-gray-300 transition">
                    CinemaHalal
                </Link>
                <nav>
                    <ul className="flex space-x-4">
                        <li><Link href="/" className="hover:text-gray-300 transition">Home</Link></li>
                        <li><Link href="/movies" className="hover:text-gray-300 transition">Movies</Link></li>
                        <li><Link href="/series" className="hover:text-gray-300 transition">Series</Link></li>
                        {!loading && (
                            <>
                                {user ? (
                                    <>
                                        {userProfile?.role === 'admin' && (
                                            <li><Link href="/admin" className="hover:text-gray-300 transition">Admin</Link></li>
                                        )}
                                        <li><Link href="/profile" className="hover:text-gray-300 transition">Profile</Link></li>
                                        <li><button onClick={handleLogout} className="hover:text-gray-300 transition">Logout</button></li>
                                    </>
                                ) : (
                                    <>
                                        <li><Link href="/login" className="hover:text-gray-300 transition">Login</Link></li>
                                        <li><Link href="/signup" className="hover:text-gray-300 transition">Sign Up</Link></li>
                                    </>
                                )}
                            </>
                        )}
                        <li><Link href="/todo" className="hover:text-gray-300 transition">Project Tasks</Link></li>
                    </ul>
                </nav>
            </div>
        </header>
    );
};

export default Header;