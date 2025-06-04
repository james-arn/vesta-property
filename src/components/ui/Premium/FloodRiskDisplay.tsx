import { FloodRisk, FloodRiskDetail } from '@/types/premiumStreetData';
import { CompleteFloodRiskAssessment, ListingFloodRiskAssessment } from '@/types/property';
import React from 'react';

interface FloodRiskDisplayProps {
    completeFloodRiskAssessment?: CompleteFloodRiskAssessment | null;
}

const ListingFloodRiskSection: React.FC<{
    listingData: ListingFloodRiskAssessment | null;
}> = ({ listingData }) => {
    if (!listingData) return null;

    const hasFloodDefences = listingData.floodDefences !== null;
    const hasFloodHistory = listingData.floodedInLastFiveYears !== null;
    const hasFloodSources = Array.isArray(listingData.floodSources) && listingData.floodSources.length > 0;

    if (!hasFloodDefences && !hasFloodHistory && !hasFloodSources) return null;

    return (
        <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h5 className="text-md font-semibold text-gray-700 mb-2">Listing Flood Risk Information</h5>
            <div className="space-y-2 text-sm">
                {hasFloodDefences && (
                    <div>
                        <span className="font-medium text-gray-600">Flood Defences:</span>
                        <span className="ml-2 text-gray-800">
                            {listingData.floodDefences ? 'Present' : 'Not Present'}
                        </span>
                    </div>
                )}
                {hasFloodHistory && (
                    <div>
                        <span className="font-medium text-gray-600">Flooded in Last 5 Years:</span>
                        <span className="ml-2 text-gray-800">
                            {listingData.floodedInLastFiveYears ? 'Yes' : 'No'}
                        </span>
                    </div>
                )}
                {hasFloodSources && listingData.floodSources && (
                    <div>
                        <span className="font-medium text-gray-600">Flood Sources:</span>
                        <span className="ml-2 text-gray-800">
                            {listingData.floodSources.join(', ')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const FloodRiskDetailSection: React.FC<{
    title: string;
    detail: FloodRiskDetail | null;
}> = ({ title, detail }) => {
    if (!detail) return null;

    return (
        <div className="mb-3">
            <h6 className="text-sm font-semibold text-gray-700 mb-1">{title}</h6>
            <div className="space-y-1 text-sm">
                {detail.risk && (
                    <div>
                        <span className="font-medium text-gray-600">Risk Level:</span>
                        <span className="ml-2 text-gray-800">{detail.risk}</span>
                    </div>
                )}
                {detail.risk_interpretation && (
                    <div>
                        <span className="font-medium text-gray-600">Interpretation:</span>
                        <span className="ml-2 text-gray-800">{detail.risk_interpretation}</span>
                    </div>
                )}
                {detail.meta?.source && (
                    <div className="mt-1">
                        <span className="text-xs text-gray-500">Source: {detail.meta.source}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const PremiumFloodRiskSection: React.FC<{
    premiumData: FloodRisk | null;
}> = ({ premiumData }) => {
    if (!premiumData) {
        return (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-blue-50">
                <p className="text-sm text-blue-800">
                    Upgrade to Premium for a detailed flood risk assessment including data from environmental agencies.
                </p>
            </div>
        );
    }

    return (
        <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h5 className="text-md font-semibold text-gray-700 mb-3">Detailed Flood Risk Assessment</h5>
            <div className="space-y-2">
                <FloodRiskDetailSection title="Rivers and Seas" detail={premiumData.rivers_and_seas} />
                <FloodRiskDetailSection title="Surface Water" detail={premiumData.surface_water} />
            </div>
        </div>
    );
};

const FloodRiskDisplay: React.FC<FloodRiskDisplayProps> = ({
    completeFloodRiskAssessment
}) => {
    const getOverallRiskStatus = (): string => {
        if (!completeFloodRiskAssessment) return 'Assessment unavailable';

        const { listingFloodRiskAssessment, premiumFloodRiskAssessment } = completeFloodRiskAssessment;

        if (premiumFloodRiskAssessment?.floodRisk) {
            return 'Includes premium assessment';
        }

        if (listingFloodRiskAssessment) {
            return 'Listing assessment available';
        }

        return 'No flood risk data available';
    };

    return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">Flood Risk Assessment</h3>
                    <span className="text-sm text-gray-600">{getOverallRiskStatus()}</span>
                </div>

                <div className="mt-4 space-y-4">
                    <ListingFloodRiskSection
                        listingData={completeFloodRiskAssessment?.listingFloodRiskAssessment ?? null}
                    />
                    <PremiumFloodRiskSection
                        premiumData={completeFloodRiskAssessment?.premiumFloodRiskAssessment?.floodRisk ?? null}
                    />
                </div>
            </div>
        </div>
    );
};

export default FloodRiskDisplay; 