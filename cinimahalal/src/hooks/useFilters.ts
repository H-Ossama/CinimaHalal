import { useState, useEffect } from 'react';

const useFilters = () => {
    const [filters, setFilters] = useState([]);
    const [isFiltering, setIsFiltering] = useState(false);

    const toggleFilter = (filterType) => {
        setFilters((prevFilters) => {
            if (prevFilters.includes(filterType)) {
                return prevFilters.filter((filter) => filter !== filterType);
            } else {
                return [...prevFilters, filterType];
            }
        });
    };

    const applyFilters = (currentTime) => {
        if (!isFiltering) return;

        return filters.map((filter) => {
            // Logic to apply each filter based on currentTime
            // This is a placeholder for actual filter logic
            return filter; 
        });
    };

    useEffect(() => {
        // Logic to fetch or initialize filters from a database or API can go here
    }, []);

    return {
        filters,
        isFiltering,
        toggleFilter,
        applyFilters,
        setIsFiltering,
    };
};

export default useFilters;