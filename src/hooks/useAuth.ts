import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { 
  loginUser, 
  registerUser, 
  logoutUser, 
  onAuthChange,
  getCurrentUser,
  getUserProfile,
  createUserProfile,
  updateUserProfile
} from '../services/firebase';

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

const useAuth = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile as UserProfile);
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    await loginUser(email, password);
  };

  const signup = async (email: string, password: string, name: string): Promise<void> => {
    const userCredential = await registerUser(email, password);
    
    await createUserProfile(userCredential.user.uid, {
      name,
      email,
      role: 'user',
    });
  };

  const logout = async (): Promise<void> => {
    await logoutUser();
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<void> => {
    if (user) {
      await updateUserProfile(user.uid, data);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, ...data });
      }
    }
  };

  return { 
    user, 
    userProfile, 
    loading, 
    login, 
    signup, 
    logout,
    updateProfile
  };
};

export default useAuth;