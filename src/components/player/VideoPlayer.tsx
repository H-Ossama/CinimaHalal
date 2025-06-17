'use client';

import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';

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

interface FilterItem {
  start: number;
  end: number;
  type: 'skip' | 'mute' | 'blur';
}

interface VideoPlayerProps {
  sources: VideoSource[];
  poster?: string;
  subtitles?: SubtitleTrack[];
  filters?: FilterItem[];
  autoplay?: boolean;
  controls?: boolean;
  fluid?: boolean;
  onReady?: (player: Player) => void;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  sources,
  poster,
  subtitles,
  filters = [],
  autoplay = false,
  controls = true,
  fluid = true,
  onReady,
  className = '',
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  
  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      
      if (videoRef.current) {
        videoRef.current.appendChild(videoElement);
      }

      const player = playerRef.current = videojs(videoElement, {
        autoplay,
        controls,
        fluid,
        responsive: true,
        playbackRates: [0.5, 1, 1.5, 2],
        sources: sources,
        poster: poster,
      }, () => {
        // Player is ready
        if (onReady) {
          onReady(player);
        }
        
        // Add subtitles
        if (subtitles && subtitles.length > 0) {
          subtitles.forEach(track => {
            player.addRemoteTextTrack({
              src: track.src,
              kind: track.kind,
              srclang: track.srclang,
              label: track.label,
              default: track.default
            }, false);
          });
        }
      });
      
      // Handle filter application
      const applyFilters = () => {
        const currentTime = player.currentTime();
        
        let shouldMute = false;
        let shouldBlur = false;
        
        filters.forEach(filter => {
          if (currentTime >= filter.start && currentTime <= filter.end) {
            switch (filter.type) {
              case 'skip':
                player.currentTime(filter.end);
                break;
              case 'mute':
                shouldMute = true;
                break;
              case 'blur':
                shouldBlur = true;
                break;
            }
          }
        });
        
        // Apply or remove mute based on current filters
        if (shouldMute && !isMuted) {
          player.muted(true);
          setIsMuted(true);
        } else if (!shouldMute && isMuted) {
          player.muted(false);
          setIsMuted(false);
        }
        
        // Apply or remove blur based on current filters
        if (shouldBlur && !isBlurred) {
          const videoElement = player.el().querySelector('.vjs-tech') as HTMLElement;
          if (videoElement) {
            videoElement.style.filter = 'blur(10px)';
            setIsBlurred(true);
          }
        } else if (!shouldBlur && isBlurred) {
          const videoElement = player.el().querySelector('.vjs-tech') as HTMLElement;
          if (videoElement) {
            videoElement.style.filter = '';
            setIsBlurred(false);
          }
        }
      };
      
      // Add time update event listener to check filters
      player.on('timeupdate', applyFilters);
    } else {
      // Update player sources
      const player = playerRef.current;
      player.src(sources);
      
      // Update poster
      if (poster) {
        player.poster(poster);
      }
      
      // Update subtitles
      if (subtitles && subtitles.length > 0) {
        // For Video.js, we need to manually dispose of text tracks
        // As a workaround, we'll add new tracks directly without removing old ones
        // as Video.js will handle duplicate detection
        subtitles.forEach(track => {
          player.addRemoteTextTrack({
            src: track.src,
            kind: track.kind,
            srclang: track.srclang,
            label: track.label,
            default: track.default
          }, false);
        });
      }
    }
  }, [sources, poster, subtitles]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className={`video-container ${className}`}>
      <div ref={videoRef} className="video-player" />
    </div>
  );
};

export default VideoPlayer;