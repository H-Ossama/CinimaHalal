import React from 'react';
import { useEffect, useState } from 'react';
import { fetchSeries } from '../../services/tmdb';
import SeriesCard from '../../components/ui/SeriesCard';

const SeriesPage = () => {
    const [seriesList, setSeriesList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getSeries = async () => {
            const series = await fetchSeries();
            setSeriesList(series);
            setLoading(false);
        };

        getSeries();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Available Series</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {seriesList.map((series) => (
                    <SeriesCard key={series.id} series={series} />
                ))}
            </div>
        </div>
    );
};

export default SeriesPage;