import { useState, useEffect, useRef } from 'react';
import type Player from 'video.js/dist/types/player';
import useFilters, { FilterTimestamp } from './useFilters';

interface VideoSource {
  src: string;
  type: string;
}

interface SubtitleTrack {
  src: string;
  kind: string;
  srclang: string;
  label: string;
  default?: boolean;
}

interface UsePlayerProps {
  contentId?: string;
  sources?: VideoSource[];
  poster?: string;
  subtitles?: SubtitleTrack[];
  autoplay?: boolean;
  startTime?: number;
  onTimeUpdate?: (time: number) => void;
  onPlayerReady?: (player: Player) => void;
}

const usePlayer = ({
  contentId,
  sources = [],
  poster,
  subtitles = [],
  autoplay = false,
  startTime = 0,
  onTimeUpdate,
  onPlayerReady
}: UsePlayerProps = {}) => {
  // Player state
  const [player, setPlayer] = useState<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tracking positions for watchlist/history
  const savedPositionRef = useRef<number>(startTime);
  const lastSaveTimeRef = useRef<number>(0);
  
  // Get filters from useFilters hook
  const { 
    filters, 
    getActiveFilterTimestamps, 
    saveUserPreferences 
  } = useFilters({ contentId });
  
  // Store active filter effects
  const [activeFilters, setActiveFilters] = useState<FilterTimestamp[]>([]);
  
  // Player initialization callback
  const handlePlayerReady = (videoPlayer: Player) => {
    setPlayer(videoPlayer);
    setLoading(false);
    
    // Set up event listeners
    videoPlayer.on('play', () => setIsPlaying(true));
    videoPlayer.on('pause', () => setIsPlaying(false));
    videoPlayer.on('timeupdate', handleTimeUpdate);
    videoPlayer.on('volumechange', () => {
      setVolume(videoPlayer.volume());
      setIsMuted(videoPlayer.muted());
    });
    videoPlayer.on('ratechange', () => setPlaybackRate(videoPlayer.playbackRate()));
    videoPlayer.on('fullscreenchange', () => setIsFullscreen(videoPlayer.isFullscreen()));
    videoPlayer.on('durationchange', () => setDuration(videoPlayer.duration()));
    videoPlayer.on('error', () => {
      setError('An error occurred while loading the video');
      setLoading(false);
    });
    
    // Set initial time if provided
    if (startTime > 0) {
      videoPlayer.currentTime(startTime);
    }
    
    // Call external onPlayerReady if provided
    if (onPlayerReady) {
      onPlayerReady(videoPlayer);
    }
  };
  
  // Handle time updates and filter application
  const handleTimeUpdate = () => {
    if (!player) return;
    
    const currentPlayerTime = player.currentTime();
    setCurrentTime(currentPlayerTime);
    
    // Check for active filters at current time
    const currentFilters = getActiveFilterTimestamps(currentPlayerTime);
    setActiveFilters(currentFilters);
    
    // Apply filter effects
    applyFilterEffects(currentFilters);
    
    // Save position periodically (every 30 seconds)
    if (currentPlayerTime - lastSaveTimeRef.current > 30) {
      savedPositionRef.current = currentPlayerTime;
      lastSaveTimeRef.current = currentPlayerTime;
      savePosition(currentPlayerTime);
    }
    
    // Call external onTimeUpdate if provided
    if (onTimeUpdate) {
      onTimeUpdate(currentPlayerTime);
    }
  };
  
  // Apply filter effects based on active filters
  const applyFilterEffects = (currentFilters: FilterTimestamp[]) => {
    if (!player) return;
    
    // Check for skip filters
    const skipFilter = currentFilters.find(filter => filter.type === 'skip');
    if (skipFilter) {
      player.currentTime(skipFilter.endTime);
      return;
    }
    
    // Check for mute filters
    const muteFilter = currentFilters.find(filter => filter.type === 'mute');
    if (muteFilter && !player.muted()) {
      player.muted(true);
    } else if (!muteFilter && player.muted() && !isMuted) {
      player.muted(false);
    }
    
    // Apply blur filters using video.js player's tech element
    const blurFilter = currentFilters.find(filter => filter.type === 'blur');
    const videoElement = player.el().querySelector('.vjs-tech') as HTMLElement;
    
    if (blurFilter && videoElement) {
      const intensity = blurFilter.intensity || 5;
      videoElement.style.filter = `blur(${intensity}px)`;
    } else if (!blurFilter && videoElement) {
      videoElement.style.filter = '';
    }
  };
  
  // Save video position to user history in database
  const savePosition = (position: number) => {
    // This could be implemented with a debounced API call
    // to save the current position for the user
    console.log(`Saving position: ${position}`);
    // Example: updateUserWatchHistory(contentId, position)
  };
  
  // Play/pause control
  const togglePlay = () => {
    if (player) {
      if (player.paused()) {
        player.play();
      } else {
        player.pause();
      }
    }
  };
  
  // Seek to specific time
  const seekTo = (time: number) => {
    if (player) {
      player.currentTime(time);
    }
  };
  
  // Volume controls
  const setVolumeLevel = (level: number) => {
    if (player) {
      const newVolume = Math.max(0, Math.min(1, level));
      player.volume(newVolume);
      if (newVolume > 0 && player.muted()) {
        player.muted(false);
      }
    }
  };
  
  const toggleMute = () => {
    if (player) {
      player.muted(!player.muted());
    }
  };
  
  // Playback rate control
  const setSpeed = (rate: number) => {
    if (player) {
      player.playbackRate(rate);
    }
  };
  
  // Fullscreen control
  const toggleFullscreen = () => {
    if (player) {
      if (player.isFullscreen()) {
        player.exitFullscreen();
      } else {
        player.requestFullscreen();
      }
    }
  };
  
  // Change active subtitle
  const setSubtitle = (index: number) => {
    if (player && subtitles) {
      const tracks = player.textTracks();
      
      // Convert TextTrackList to Array for easier manipulation
      const tracksArray = Array.prototype.slice.call(tracks);
      
      tracksArray.forEach((track, i) => {
        track.mode = i === index ? 'showing' : 'hidden';
      });
      
      setActiveSubtitleIndex(index);
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Save final position on component unmount
      if (currentTime > 0) {
        savePosition(currentTime);
      }
    };
  }, [currentTime]);
  
  return {
    player,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isFullscreen,
    loading,
    error,
    activeSubtitleIndex,
    activeFilters,
    handlePlayerReady,
    togglePlay,
    seekTo,
    setVolumeLevel,
    toggleMute,
    setSpeed,
    toggleFullscreen,
    setSubtitle,
  };
};

export default usePlayer;