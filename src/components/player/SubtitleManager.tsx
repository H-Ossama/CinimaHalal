'use client';

import React, { useEffect, useState } from 'react';

interface Subtitle {
  id: number;
  start: number; // in seconds
  end: number; // in seconds
  text: string;
}

interface SubtitleManagerProps {
  videoTime: number;
  subtitleUrl?: string;
  subtitles?: Subtitle[];
  backgroundColor?: string;
  textColor?: string;
  className?: string;
  onSubtitlesLoaded?: (subtitles: Subtitle[]) => void;
}

const SubtitleManager: React.FC<SubtitleManagerProps> = ({
  videoTime,
  subtitleUrl,
  subtitles: providedSubtitles,
  backgroundColor = 'rgba(0, 0, 0, 0.7)',
  textColor = 'white',
  className = '',
  onSubtitlesLoaded
}) => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>(providedSubtitles || []);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse SRT file format
  const parseSRT = (srtContent: string): Subtitle[] => {
    const subtitles: Subtitle[] = [];
    
    // Split the content by double newline (subtitle separator)
    const subtitleBlocks = srtContent.trim().split(/\r?\n\r?\n/);
    
    for (const block of subtitleBlocks) {
      const lines = block.split(/\r?\n/);
      
      if (lines.length < 3) continue;
      
      // First line is the subtitle ID
      const id = parseInt(lines[0], 10);
      
      // Second line is the timestamp
      const timestamps = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      
      if (!timestamps) continue;
      
      // Convert timestamp to seconds
      const startHours = parseInt(timestamps[1], 10);
      const startMinutes = parseInt(timestamps[2], 10);
      const startSeconds = parseInt(timestamps[3], 10);
      const startMilliseconds = parseInt(timestamps[4], 10);
      
      const endHours = parseInt(timestamps[5], 10);
      const endMinutes = parseInt(timestamps[6], 10);
      const endSeconds = parseInt(timestamps[7], 10);
      const endMilliseconds = parseInt(timestamps[8], 10);
      
      const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
      const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
      
      // The rest of the lines are the text
      const text = lines.slice(2).join(' ');
      
      subtitles.push({ id, start, end, text });
    }
    
    return subtitles;
  };
  
  // Parse VTT file format
  const parseVTT = (vttContent: string): Subtitle[] => {
    const subtitles: Subtitle[] = [];
    
    // Remove the WEBVTT header
    const content = vttContent.replace(/^WEBVTT\r?\n/, '');
    
    // Split the content by double newline (subtitle separator)
    const subtitleBlocks = content.trim().split(/\r?\n\r?\n/);
    
    let idCounter = 1;
    
    for (const block of subtitleBlocks) {
      const lines = block.split(/\r?\n/);
      
      if (lines.length < 2) continue;
      
      // Find the line with the timestamp
      const timestampLine = lines.find(line => line.includes('-->'));
      if (!timestampLine) continue;
      
      // Extract timestamps
      const timestamps = timestampLine.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      
      if (!timestamps) continue;
      
      // Convert timestamp to seconds
      const startHours = parseInt(timestamps[1], 10);
      const startMinutes = parseInt(timestamps[2], 10);
      const startSeconds = parseInt(timestamps[3], 10);
      const startMilliseconds = parseInt(timestamps[4], 10);
      
      const endHours = parseInt(timestamps[5], 10);
      const endMinutes = parseInt(timestamps[6], 10);
      const endSeconds = parseInt(timestamps[7], 10);
      const endMilliseconds = parseInt(timestamps[8], 10);
      
      const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
      const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
      
      // The text is all lines after the timestamp
      const timestampIndex = lines.indexOf(timestampLine);
      const text = lines.slice(timestampIndex + 1).join(' ');
      
      subtitles.push({ id: idCounter++, start, end, text });
    }
    
    return subtitles;
  };
  
  // Fetch subtitles if URL is provided
  useEffect(() => {
    if (subtitleUrl && !providedSubtitles) {
      fetch(subtitleUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch subtitles: ${response.status}`);
          }
          return response.text();
        })
        .then(content => {
          let parsedSubtitles: Subtitle[] = [];
          
          // Determine file type and parse accordingly
          if (subtitleUrl.endsWith('.srt')) {
            parsedSubtitles = parseSRT(content);
          } else if (subtitleUrl.endsWith('.vtt')) {
            parsedSubtitles = parseVTT(content);
          } else {
            throw new Error('Unsupported subtitle format. Only .srt and .vtt are supported.');
          }
          
          setSubtitles(parsedSubtitles);
          
          if (onSubtitlesLoaded) {
            onSubtitlesLoaded(parsedSubtitles);
          }
        })
        .catch(err => {
          setError(err.message);
          console.error('Error loading subtitles:', err);
        });
    }
  }, [subtitleUrl, providedSubtitles, onSubtitlesLoaded]);
  
  // Find and set the current subtitle based on video time
  useEffect(() => {
    if (subtitles.length === 0) {
      setCurrentSubtitle(null);
      return;
    }
    
    const activeSubtitle = subtitles.find(sub => videoTime >= sub.start && videoTime <= sub.end);
    setCurrentSubtitle(activeSubtitle ? activeSubtitle.text : null);
  }, [videoTime, subtitles]);
  
  if (error) {
    console.error(`Subtitle error: ${error}`);
    return null;
  }
  
  if (!currentSubtitle) {
    return null;
  }

  return (
    <div 
      className={`subtitle-container ${className}`}
      style={{
        position: 'absolute',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor,
        color: textColor,
        padding: '8px 16px',
        borderRadius: '4px',
        maxWidth: '80%',
        textAlign: 'center',
        zIndex: 10,
        transition: 'all 0.3s ease',
      }}
    >
      {currentSubtitle}
    </div>
  );
};

export default SubtitleManager;