import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  subtitles: string;
  filters: { start: number; end: number; type: string }[];
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, subtitles, filters }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const applyFilters = () => {
        const currentTime = video.currentTime;
        filters.forEach(filter => {
          if (currentTime >= filter.start && currentTime <= filter.end) {
            switch (filter.type) {
              case 'skip':
                video.currentTime = filter.end;
                break;
              case 'mute':
                video.volume = 0;
                break;
              case 'blur':
                video.style.filter = 'blur(10px)';
                break;
              default:
                break;
            }
          }
        });
      };

      const interval = setInterval(applyFilters, 1000);
      return () => clearInterval(interval);
    }
  }, [filters]);

  return (
    <div className="video-player">
      <video ref={videoRef} controls className="w-full">
        <source src={src} type="video/mp4" />
        <track src={subtitles} kind="subtitles" srcLang="ar" label="Arabic" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;