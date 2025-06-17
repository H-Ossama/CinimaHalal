import { useState, useEffect } from 'react';

const usePlayer = (videoUrl) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [filters, setFilters] = useState([]);

    const togglePlay = () => {
        setIsPlaying((prev) => !prev);
    };

    const seekTo = (time) => {
        setCurrentTime(time);
    };

    const toggleMute = () => {
        setIsMuted((prev) => !prev);
    };

    const addFilter = (filter) => {
        setFilters((prev) => [...prev, filter]);
    };

    const removeFilter = (filter) => {
        setFilters((prev) => prev.filter((f) => f !== filter));
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (isPlaying) {
                setCurrentTime((prev) => prev + 1); // Simulate time progression
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isPlaying]);

    return {
        isPlaying,
        currentTime,
        duration,
        isMuted,
        filters,
        togglePlay,
        seekTo,
        toggleMute,
        addFilter,
        removeFilter,
    };
};

export default usePlayer;