import { db } from './firebase';
import { collection, doc, getDoc, setDoc, query, where, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FilterTimestamp } from '../hooks/useFilters';
import { Filter } from '../lib/types';

// Types for filter data
export interface FilterTimestampData extends FilterTimestamp {
  createdAt: Date;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
  reports?: number;
  votes?: number;
  contentId: string;
}

export interface FilterPreference {
  enabled: boolean;
  intensity?: number;
}

export interface ContentFilterData {
  contentId: string;
  contentType: 'movie' | 'series' | 'episode';
  title: string;
  timestamps: FilterTimestamp[];
  lastUpdated: Date;
  lastUpdatedBy: string;
  userPreferences: {
    [userId: string]: {
      [filterId: string]: FilterPreference;
    };
  };
}

// Default filters for demonstration
const defaultFilters: FilterTimestamp[] = [
  { id: 'violence', startTime: 212.5, endTime: 218.0, type: 'skip', category: 'violence', description: 'Violent scene' },
  { id: 'language', startTime: 470.3, endTime: 475.1, type: 'mute', category: 'profanity', description: 'Strong language' },
  { id: 'intimate', startTime: 890.2, endTime: 895.4, type: 'blur', intensity: 8, category: 'intimate', description: 'Intimate scene' },
];

/**
 * Get filter data for a specific content
 */
export const getFilters = async (contentId: string): Promise<FilterTimestamp[]> => {
  try {
    const docRef = doc(db, 'filters', contentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && docSnap.data().timestamps) {
      return docSnap.data().timestamps as FilterTimestamp[];
    }

    // Return default filters for demo purposes if no custom filters are found
    return defaultFilters;
  } catch (error) {
    console.error('Error getting filters:', error);
    return defaultFilters;
  }
};

/**
 * Save filter data for a specific content
 */
export const saveFilters = async (
  contentId: string,
  timestamps: FilterTimestamp[],
  userId: string
): Promise<void> => {
  try {
    const filterData = {
      contentId,
      timestamps,
      lastUpdated: new Date(),
      lastUpdatedBy: userId
    };

    await setDoc(doc(db, 'filters', contentId), filterData, { merge: true });
  } catch (error) {
    console.error('Error saving filters:', error);
    throw error;
  }
};

/**
 * Add a new filter timestamp
 */
export const addFilterTimestamp = async (
  contentId: string,
  timestamp: Omit<FilterTimestamp, 'id'>,
  userId: string
): Promise<string> => {
  try {
    // Generate a unique ID for the filter
    const filterId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create the filter timestamp with additional metadata
    const filterTimestampData: FilterTimestampData = {
      ...timestamp,
      id: filterId,
      createdAt: new Date(),
      createdBy: userId,
      status: 'pending',
      contentId,
    };
    
    // Add to the pending filters collection for admin review
    const pendingFilterRef = await addDoc(collection(db, 'pendingFilters'), filterTimestampData);
    
    // Also add to the content's filters if it exists
    const contentFilterRef = doc(db, 'filters', contentId);
    const contentFilterDoc = await getDoc(contentFilterRef);
    
    if (contentFilterDoc.exists()) {
      // Add the new timestamp to existing timestamps
      const existingData = contentFilterDoc.data();
      const timestamps = existingData.timestamps || [];
      
      await updateDoc(contentFilterRef, {
        timestamps: [...timestamps, { ...timestamp, id: filterId }],
        lastUpdated: new Date(),
        lastUpdatedBy: userId
      });
    } else {
      // Create a new filter document
      await setDoc(contentFilterRef, {
        contentId,
        timestamps: [{ ...timestamp, id: filterId }],
        lastUpdated: new Date(),
        lastUpdatedBy: userId,
        userPreferences: {}
      });
    }
    
    return filterId;
  } catch (error) {
    console.error('Error adding filter timestamp:', error);
    throw error;
  }
};

/**
 * Review a pending filter (for admins)
 */
export const reviewFilter = async (
  filterId: string,
  status: 'approved' | 'rejected',
  adminId: string
): Promise<void> => {
  try {
    // Find the filter in the pending collection
    const pendingFiltersRef = collection(db, 'pendingFilters');
    const q = query(pendingFiltersRef, where('id', '==', filterId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('Filter not found');
    }
    
    const filterDoc = querySnapshot.docs[0];
    const filterData = filterDoc.data() as FilterTimestampData;
    
    // Update the status
    await updateDoc(filterDoc.ref, {
      status,
      approvedBy: adminId,
      approvedAt: new Date()
    });
    
    // If rejected, remove from content filters
    if (status === 'rejected') {
      const contentFilterRef = doc(db, 'filters', filterData.contentId);
      const contentFilterDoc = await getDoc(contentFilterRef);
      
      if (contentFilterDoc.exists()) {
        const existingData = contentFilterDoc.data();
        const timestamps = existingData.timestamps || [];
        
        await updateDoc(contentFilterRef, {
          timestamps: timestamps.filter((t: FilterTimestamp) => t.id !== filterId),
          lastUpdated: new Date(),
          lastUpdatedBy: adminId
        });
      }
    }
  } catch (error) {
    console.error('Error reviewing filter:', error);
    throw error;
  }
};

/**
 * Save user filter preferences
 */
export const saveUserFilterPreferences = async (
  contentId: string,
  userId: string,
  preferences: { [filterId: string]: FilterPreference }
): Promise<void> => {
  try {
    const contentFilterRef = doc(db, 'filters', contentId);
    const contentFilterDoc = await getDoc(contentFilterRef);
    
    if (contentFilterDoc.exists()) {
      const existingData = contentFilterDoc.data();
      const userPreferences = existingData.userPreferences || {};
      
      await updateDoc(contentFilterRef, {
        userPreferences: {
          ...userPreferences,
          [userId]: preferences
        }
      });
    } else {
      await setDoc(contentFilterRef, {
        contentId,
        timestamps: [],
        lastUpdated: new Date(),
        lastUpdatedBy: userId,
        userPreferences: {
          [userId]: preferences
        }
      });
    }
  } catch (error) {
    console.error('Error saving user filter preferences:', error);
    throw error;
  }
};

/**
 * Get user filter preferences
 */
export const getUserFilterPreferences = async (
  contentId: string,
  userId: string
): Promise<{ [filterId: string]: FilterPreference } | null> => {
  try {
    const contentFilterRef = doc(db, 'filters', contentId);
    const contentFilterDoc = await getDoc(contentFilterRef);
    
    if (contentFilterDoc.exists()) {
      const data = contentFilterDoc.data();
      const userPreferences = data.userPreferences || {};
      
      return userPreferences[userId] || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user filter preferences:', error);
    return null;
  }
};

// Helper function to apply filters to current playback time
export const applyFilters = (
  currentTime: number,
  filters: FilterTimestamp[],
  enabledFilterIds: string[]
): FilterTimestamp[] => {
  return filters.filter(
    filter =>
      enabledFilterIds.includes(filter.id) &&
      currentTime >= filter.startTime &&
      currentTime <= filter.endTime
  );
};

export default {
  getFilters,
  saveFilters,
  addFilterTimestamp,
  reviewFilter,
  saveUserFilterPreferences,
  getUserFilterPreferences,
  applyFilters,
};