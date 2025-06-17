import React, { useEffect, useState } from 'react';

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

const SubtitleManager: React.FC<{ videoTime: number; subtitles: Subtitle[] }> = ({ videoTime, subtitles }) => {
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

  useEffect(() => {
    const activeSubtitle = subtitles.find(sub => videoTime >= sub.start && videoTime <= sub.end);
    setCurrentSubtitle(activeSubtitle ? activeSubtitle.text : null);
  }, [videoTime, subtitles]);

  return (
    <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white p-2 rounded">
      {currentSubtitle}
    </div>
  );
};

export default SubtitleManager;