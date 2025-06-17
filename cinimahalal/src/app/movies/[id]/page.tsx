import React from 'react';
import { useRouter } from 'next/router';
import VideoPlayer from '../../../components/player/VideoPlayer';
import SubtitleManager from '../../../components/player/SubtitleManager';
import FilterControls from '../../../components/player/FilterControls';
import { fetchMovieDetails } from '../../../services/tmdb';

const MovieDetailPage = () => {
    const router = useRouter();
    const { id } = router.query;

    const [movie, setMovie] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (id) {
            const getMovieDetails = async () => {
                const data = await fetchMovieDetails(id);
                setMovie(data);
                setLoading(false);
            };
            getMovieDetails();
        }
    }, [id]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!movie) {
        return <div>Movie not found</div>;
    }

    return (
        <div className="movie-detail-page">
            <h1 className="text-2xl font-bold">{movie.title}</h1>
            <VideoPlayer videoUrl={movie.videoUrl} />
            <SubtitleManager movieId={id} />
            <FilterControls />
            <div className="movie-info">
                <p>Year: {movie.year}</p>
                <p>Duration: {movie.duration} minutes</p>
                <p>Genre: {movie.genre}</p>
                <img src={movie.poster} alt={movie.title} />
            </div>
        </div>
    );
};

export default MovieDetailPage;