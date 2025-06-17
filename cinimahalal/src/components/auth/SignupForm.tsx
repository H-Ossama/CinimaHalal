import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { auth } from '../../lib/firebase'; // Adjust the import based on your firebase setup
import { createUserWithEmailAndPassword } from 'firebase/auth';

const SignupForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            router.push('/'); // Redirect to homepage after signup
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
            {error && <p className="text-red-500">{error}</p>}
            <form onSubmit={handleSignup} className="flex flex-col w-80">
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border p-2 mb-4"
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border p-2 mb-4"
                    required
                />
                <button type="submit" className="bg-blue-500 text-white p-2 rounded">
                    Sign Up
                </button>
            </form>
        </div>
    );
};

export default SignupForm;