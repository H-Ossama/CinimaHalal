import React from 'react';
import { useRouter } from 'next/router';
import { getSeriesDetails } from '../../../lib/tmdb'; // Assuming you have a function to fetch series details
import VideoPlayer from '../../../components/player/VideoPlayer';
import FilterControls from '../../../components/player/FilterControls';
import SubtitleManager from '../../../components/player/SubtitleManager';

const SeriesPage = () => {
    const router = useRouter();
    const { id } = router.query; // Get series ID from the URL
    const [series, setSeries] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (id) {
            const fetchSeries = async () => {
                const data = await getSeriesDetails(id);
                setSeries(data);
                setLoading(false);
            };
            fetchSeries();
        }
    }, [id]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!series) {
        return <div>Series not found.</div>;
    }

    return (
        <div>
            <h1>{series.title}</h1>
            <VideoPlayer videoUrl={series.videoUrl} />
            <SubtitleManager subtitles={series.subtitles} />
            <FilterControls />
            {/* Additional series details and episodes can be rendered here */}
        </div>
    );
};

export default SeriesPage;