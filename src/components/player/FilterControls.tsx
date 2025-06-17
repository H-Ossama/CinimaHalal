'use client';

import React, { useState } from 'react';

export interface FilterType {
  id: string;
  type: 'skip' | 'mute' | 'blur';
  label: string;
  description: string;
  enabled: boolean;
  intensity?: number; // For blur filter (1-10)
  categories?: string[]; // For categorization (violence, language, etc.)
}

interface FilterControlsProps {
  filters: FilterType[];
  onToggleFilter: (filterId: string) => void;
  onChangeIntensity?: (filterId: string, intensity: number) => void;
  onSavePreset?: () => void;
  onLoadPreset?: () => void;
  className?: string;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  onToggleFilter,
  onChangeIntensity,
  onSavePreset,
  onLoadPreset,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`filter-controls bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-md ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold dark:text-white">Content Filtering</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-400"
        >
          {expanded ? 'Collapse' : 'Expand'} Options
        </button>
      </div>
      
      {expanded && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filters.map((filter) => (
              <div 
                key={filter.id} 
                className="filter-item bg-white dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={filter.id}
                      checked={filter.enabled}
                      onChange={() => onToggleFilter(filter.id)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor={filter.id} className="ml-2 text-md font-medium dark:text-white">
                      {filter.label}
                    </label>
                  </div>
                  
                  {filter.categories && filter.categories.length > 0 && (
                    <div className="flex space-x-1">
                      {filter.categories.map(category => (
                        <span 
                          key={category}
                          className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{filter.description}</p>
                
                {filter.type === 'blur' && filter.enabled && onChangeIntensity && (
                  <div className="mt-2">
                    <label htmlFor={`${filter.id}-intensity`} className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                      Blur Intensity: {filter.intensity}
                    </label>
                    <input
                      type="range"
                      id={`${filter.id}-intensity`}
                      min="1"
                      max="10"
                      value={filter.intensity || 5}
                      onChange={(e) => onChangeIntensity(filter.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer dark:bg-blue-700"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {(onSavePreset || onLoadPreset) && (
            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              {onSavePreset && (
                <button 
                  onClick={onSavePreset}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                >
                  Save Preferences
                </button>
              )}
              {onLoadPreset && (
                <button
                  onClick={onLoadPreset}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                >
                  Load Preferences
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {!expanded && (
        <div className="flex flex-wrap gap-2">
          {filters.filter(f => f.enabled).map((filter) => (
            <span 
              key={filter.id}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm dark:bg-blue-900 dark:text-blue-200"
            >
              {filter.label}
            </span>
          ))}
          {filters.filter(f => f.enabled).length === 0 && (
            <span className="text-gray-500 dark:text-gray-400 text-sm">No filters active</span>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterControls;