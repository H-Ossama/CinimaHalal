import React from 'react';
import { useRouter } from 'next/router';
import VideoPlayer from '@/components/player/VideoPlayer';
import SubtitleManager from '@/components/player/SubtitleManager';
import FilterControls from '@/components/player/FilterControls';

const EpisodePage = () => {
    const router = useRouter();
    const { id, season, episode } = router.query;

    return (
        <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">Episode {episode} of Season {season}</h1>
            <VideoPlayer episodeId={episode} seasonId={season} seriesId={id} />
            <SubtitleManager episodeId={episode} />
            <FilterControls />
        </div>
    );
};

export default EpisodePage;