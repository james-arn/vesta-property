import React, { useEffect, useState } from 'react';

interface CrimeScoreResponse {
    crimeRating: string;
    crimeScore: string;
    crimeSummary: Record<string, number>;
    monthsAggregated: string[];
    totalCrimes: number;
}

const CrimeScore: React.FC<{ lat: string; lng: string }> = ({ lat, lng }) => {
    const [data, setData] = useState<CrimeScoreResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const endpoint = `${process.env.VESTA_AWS_ENDPOINT}/crime-score?lat=${lat}&lng=${lng}`;

        fetch(endpoint)
            .then((res) => {
                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }
                return res.json();
            })
            .then((json: CrimeScoreResponse) => {
                setData(json);
            })
            .catch((err) => {
                setError(err.message);
            });
    }, [lat, lng]);

    if (error) {
        return <div>Error: {error}</div>;
    }
    if (!data) {
        return <div>Crime Score Loading...</div>;
    }
    return (
        <div>
            <h3>Crime Rating: {data.crimeRating}</h3>
            <p>Crime Score: {data.crimeScore}</p>
            <p>Total Crimes (aggregated over 6 months): {data.totalCrimes}</p>
            <pre>{JSON.stringify(data.crimeSummary, null, 2)}</pre>
        </div>
    );
};

export default CrimeScore; 