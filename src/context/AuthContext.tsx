'use client';

import { createContext, useContext, ReactNode } from 'react';
import useAuth from '../hooks/useAuth';
import { User } from 'firebase/auth';

interface UserProfile {
  uid: string;
  name?: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  updateProfile: async () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
