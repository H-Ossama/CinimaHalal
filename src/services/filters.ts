import { Filter } from '../lib/types';

const filters: Filter[] = [
  { start: 212.5, end: 218.0, type: 'skip' },
  { start: 470.3, end: 475.1, type: 'mute' },
  { start: 890.2, end: 895.4, type: 'blur' },
];

export const applyFilters = (currentTime: number, enabledFilters: Filter[]) => {
  return enabledFilters.filter(filter => 
    currentTime >= filter.start && currentTime <= filter.end
  );
};

export const addFilter = (newFilter: Filter) => {
  filters.push(newFilter);
};

export const removeFilter = (filterToRemove: Filter) => {
  const index = filters.findIndex(filter => 
    filter.start === filterToRemove.start && filter.end === filterToRemove.end && filter.type === filterToRemove.type
  );
  if (index !== -1) {
    filters.splice(index, 1);
  }
};

export const getFilters = () => {
  return filters;
};