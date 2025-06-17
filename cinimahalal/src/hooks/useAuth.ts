import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase'; // Adjust the import path as necessary
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';

const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email, password) => {
        return await signInWithEmailAndPassword(auth, email, password);
    };

    const signup = async (email, password) => {
        return await createUserWithEmailAndPassword(auth, email, password);
    };

    const logout = async () => {
        return await signOut(auth);
    };

    return { user, loading, login, signup, logout };
};

export default useAuth;