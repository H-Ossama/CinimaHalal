import React from 'react';

const FilterControls = ({ onToggleFilter, filters }) => {
    return (
        <div className="flex space-x-4">
            {filters.map((filter) => (
                <div key={filter.type} className="flex items-center">
                    <input
                        type="checkbox"
                        id={filter.type}
                        checked={filter.enabled}
                        onChange={() => onToggleFilter(filter.type)}
                        className="mr-2"
                    />
                    <label htmlFor={filter.type} className="text-lg">
                        {filter.label}
                    </label>
                </div>
            ))}
        </div>
    );
};

export default FilterControls;