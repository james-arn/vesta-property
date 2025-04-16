import { FloodRisk, FloodRiskDetail } from '@/types/premiumStreetData';
import React from 'react';

interface FloodRiskDisplayProps {
    floodRisk: FloodRisk | null | undefined;
}

const FloodRiskDetailItem: React.FC<{
    title: string;
    detail: FloodRiskDetail | null | undefined;
}> = ({ title, detail }) => {
    if (!detail) {
        return (
            <div className="flood-risk-detail-item">
                <h4>{title}</h4>
                <p>Risk details not available.</p>
            </div>
        );
    }

    return (
        <div className="flood-risk-detail-item">
            <h4>{title}</h4>
            <p><strong>Risk Level:</strong> {detail.risk ?? 'N/A'}</p>
            {detail.risk_interpretation && (
                <p><strong>Interpretation:</strong> {detail.risk_interpretation}</p>
            )}
            {detail.meta?.source && <p>Source: {detail.meta.source}</p>}
        </div>
    );
};

const FloodRiskDisplay: React.FC<FloodRiskDisplayProps> = ({ floodRisk }) => {
    if (!floodRisk) {
        return <div>Flood risk information not available.</div>;
    }

    return (
        <div className="flood-risk-display">
            <h3>Flood Risk Assessment</h3>
            <FloodRiskDetailItem title="Rivers and Seas" detail={floodRisk.rivers_and_seas} />
            <FloodRiskDetailItem title="Surface Water" detail={floodRisk.surface_water} />
        </div>
    );
};

export default FloodRiskDisplay; 