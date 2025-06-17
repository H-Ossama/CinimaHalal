// Firebase integration for authentication, database, and storage
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  UserCredential
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  updateDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Authentication functions
export const registerUser = async (email: string, password: string): Promise<UserCredential> => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const loginUser = async (email: string, password: string): Promise<UserCredential> => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async (): Promise<void> => {
  return signOut(auth);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

// User related functions
export const createUserProfile = async (userId: string, userData: any): Promise<void> => {
  await setDoc(doc(db, 'users', userId), {
    ...userData,
    createdAt: new Date(),
  });
};

export const getUserProfile = async (userId: string): Promise<any | null> => {
  const docSnap = await getDoc(doc(db, 'users', userId));
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateUserProfile = async (userId: string, userData: any): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), userData);
};

// Content related functions
export const saveFilterData = async (movieId: string, filterData: any): Promise<void> => {
  await setDoc(doc(db, 'filters', movieId), filterData);
};

export const getFilterData = async (movieId: string): Promise<any | null> => {
  const docSnap = await getDoc(doc(db, 'filters', movieId));
  return docSnap.exists() ? docSnap.data() : null;
};

export const addMovieReview = async (userId: string, movieId: string, review: any): Promise<string> => {
  const reviewRef = await addDoc(collection(db, 'reviews'), {
    userId,
    movieId,
    ...review,
    createdAt: new Date()
  });
  return reviewRef.id;
};

export const getMovieReviews = async (movieId: string): Promise<any[]> => {
  const q = query(collection(db, 'reviews'), where('movieId', '==', movieId));
  const querySnapshot = await getDocs(q);
  
  const reviews: any[] = [];
  querySnapshot.forEach((doc) => {
    reviews.push({ id: doc.id, ...doc.data() });
  });
  
  return reviews;
};

// Storage functions
export const uploadFile = async (path: string, file: File): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const deleteFile = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};

// Exports
export { app, auth, db, storage };
export default app;
