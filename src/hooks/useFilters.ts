import { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import * as filtersService from '../services/filters';

export interface FilterTimestamp {
  id: string;
  startTime: number;
  endTime: number;
  type: 'skip' | 'mute' | 'blur';
  intensity?: number; // For blur filter (1-10)
  category?: string; // Violence, language, intimate, etc.
  description?: string;
}

interface UseFiltersProps {
  contentId?: string;
  initialFilters?: FilterTimestamp[];
}

const useFilters = ({ contentId, initialFilters = [] }: UseFiltersProps = {}) => {
  // State for filters
  const [filters, setFilters] = useState<FilterTimestamp[]>(initialFilters);
  const [enabledFilterIds, setEnabledFilterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get auth context for user ID
  const { user, userProfile } = useAuthContext();
  
  // Fetch filters for the content
  useEffect(() => {
    if (!contentId) {
      setFilters(initialFilters);
      setLoading(false);
      return;
    }
    
    const fetchFilters = async () => {
      try {
        setLoading(true);
        const contentFilters = await filtersService.getFilters(contentId);
        setFilters(contentFilters);
        
        // If user is logged in, fetch their preferences
        if (user) {
          const preferences = await filtersService.getUserFilterPreferences(contentId, user.uid);
          if (preferences) {
            // Enable filters that were previously enabled
            const enabledIds = Object.entries(preferences)
              .filter(([_, pref]) => pref.enabled)
              .map(([id]) => id);
            setEnabledFilterIds(enabledIds);
          } else {
            // Default: enable all filters
            setEnabledFilterIds(contentFilters.map(filter => filter.id));
          }
        } else {
          // Default: enable all filters
          setEnabledFilterIds(contentFilters.map(filter => filter.id));
        }
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load filters');
        setLoading(false);
      }
    };
    
    fetchFilters();
  }, [contentId, user]);
  
  // Toggle a filter on/off
  const toggleFilter = (filterId: string) => {
    setEnabledFilterIds(prev => {
      if (prev.includes(filterId)) {
        return prev.filter(id => id !== filterId);
      } else {
        return [...prev, filterId];
      }
    });
  };
  
  // Enable or disable all filters
  const toggleAllFilters = (enable: boolean) => {
    if (enable) {
      setEnabledFilterIds(filters.map(filter => filter.id));
    } else {
      setEnabledFilterIds([]);
    }
  };
  
  // Add a new filter timestamp
  const addFilterTimestamp = async (filter: Omit<FilterTimestamp, 'id'>) => {
    if (!contentId || !user) {
      setError('User must be logged in to add filters');
      return null;
    }
    
    try {
      const filterId = await filtersService.addFilterTimestamp(contentId, filter, user.uid);
      
      // Add the new filter to the local state
      const newFilter: FilterTimestamp = { ...filter, id: filterId };
      setFilters(prev => [...prev, newFilter]);
      
      // Enable the new filter by default
      setEnabledFilterIds(prev => [...prev, filterId]);
      
      return filterId;
    } catch (err: any) {
      setError(err.message || 'Failed to add filter');
      return null;
    }
  };
  
  // Update filter intensity (for blur filter)
  const updateFilterIntensity = (filterId: string, intensity: number) => {
    setFilters(prev => 
      prev.map(filter => 
        filter.id === filterId 
          ? { ...filter, intensity } 
          : filter
      )
    );
  };
  
  // Save user preferences to database
  const saveUserPreferences = async () => {
    if (!contentId || !user) {
      setError('User must be logged in to save preferences');
      return false;
    }
    
    try {
      const preferences: { [filterId: string]: { enabled: boolean; intensity?: number } } = {};
      
      filters.forEach(filter => {
        preferences[filter.id] = {
          enabled: enabledFilterIds.includes(filter.id),
          intensity: filter.intensity
        };
      });
      
      await filtersService.saveUserFilterPreferences(contentId, user.uid, preferences);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences');
      return false;
    }
  };
  
  // Get active filter timestamps for current time
  const getActiveFilterTimestamps = (currentTime: number): FilterTimestamp[] => {
    return filters.filter(
      filter =>
        enabledFilterIds.includes(filter.id) &&
        currentTime >= filter.startTime &&
        currentTime <= filter.endTime
    );
  };
  
  return {
    filters,
    enabledFilterIds,
    loading,
    error,
    toggleFilter,
    toggleAllFilters,
    addFilterTimestamp,
    updateFilterIntensity,
    saveUserPreferences,
    getActiveFilterTimestamps
  };
};

export default useFilters;