import { FloodRisk, FloodRiskDetail } from '@/types/premiumStreetData';
import React, { useState } from 'react';

interface FloodRiskDisplayProps {
    floodRisk: FloodRisk | null | undefined;
    floodDefence?: string | null;
    floodLast5Years?: string | null;
    floodSource?: string | null;
    isDetailedAssessmentUnlocked?: boolean; // To manage paid feature
}

const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
);

const ChevronUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
        <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 9.06l-3.71 3.71a.75.75 0 11-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
    </svg>
);

const FloodRiskDetailItem: React.FC<{
    title: string;
    detail: FloodRiskDetail | null | undefined;
}> = ({ title, detail }) => {
    if (!detail) {
        return (
            <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 className="text-md font-semibold text-gray-700 mb-1">{title}</h5>
                <p className="text-sm text-gray-500">Risk details not available.</p>
            </div>
        );
    }

    return (
        <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h5 className="text-md font-semibold text-gray-700 mb-2">{title}</h5>
            <div className="space-y-1 text-sm">
                <div>
                    <span className="font-medium text-gray-600">Risk Level:</span>
                    <span className="ml-2 text-gray-800">{detail.risk ?? 'N/A'}</span>
                </div>
                {detail.risk_interpretation && (
                    <div>
                        <span className="font-medium text-gray-600">Interpretation:</span>
                        <span className="ml-2 text-gray-800">{detail.risk_interpretation}</span>
                    </div>
                )}
                {detail.meta?.source && (
                    <div className="mt-2">
                        <span className="text-xs text-gray-500">Source: {detail.meta.source}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const FloodRiskDisplay: React.FC<FloodRiskDisplayProps> = ({
    floodRisk,
    floodDefence,
    floodLast5Years,
    floodSource,
    isDetailedAssessmentUnlocked = false, // Default to locked
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleAccordion = () => setIsOpen(!isOpen);

    // Determine overall risk status for display in the accordion header
    const getOverallRiskStatus = () => {
        if (!isDetailedAssessmentUnlocked && !floodRisk) return 'Unlock to view';
        if (!floodRisk) return 'Assessment unavailable'; // Should ideally not happen if unlocked
        if (floodRisk.rivers_and_seas?.risk || floodRisk.surface_water?.risk) return 'Details available';
        return 'No immediate risks identified';
    };
    const overallRiskStatus = getOverallRiskStatus();

    // If the feature isn't unlocked AND there's no basic flood risk data, show a specific CTA.
    if (!isDetailedAssessmentUnlocked && !floodRisk) {
        return (
            <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Flood Risk Assessment</h3>
                    {/* This could be a button/link to an upgrade modal/page */}
                    <span className="text-sm text-blue-600 hover:text-blue-800">
                        Unlock Detailed Assessment
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
            <div
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-150 ease-in-out"
                onClick={toggleAccordion}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleAccordion()}
                aria-expanded={isOpen}
                aria-controls="flood-risk-details"
            >
                <h3 className="text-lg font-semibold text-gray-800">Flood Risk Assessment</h3>
                <div className="flex items-center">
                    <span
                        className={`text-sm mr-2 ${!isDetailedAssessmentUnlocked && !floodRisk
                            ? 'text-blue-600'
                            : floodRisk && (floodRisk.rivers_and_seas?.risk || floodRisk.surface_water?.risk)
                                ? 'text-orange-500' // Or some other color for risk present
                                : 'text-gray-600'
                            }`}
                    >
                        {overallRiskStatus}
                    </span>
                    {isOpen ? (
                        <ChevronUpIcon className="text-gray-600 h-5 w-5" />
                    ) : (
                        <ChevronDownIcon className="text-gray-600 h-5 w-5" />
                    )}
                </div>
            </div>

            {isOpen && (
                <div id="flood-risk-details" className="p-4 border-t border-gray-200 bg-gray-50">
                    {isDetailedAssessmentUnlocked && floodRisk ? (
                        <>
                            <FloodRiskDetailItem title="Rivers and Seas" detail={floodRisk.rivers_and_seas} />
                            <FloodRiskDetailItem title="Surface Water" detail={floodRisk.surface_water} />

                            {/* Display additional details only if assessment is unlocked */}
                            {floodDefence && (
                                <div className="mb-4 p-3 border border-gray-200 rounded-md bg-white">
                                    <h5 className="text-md font-semibold text-gray-700 mb-1">Flood Defences</h5>
                                    <p className="text-sm text-gray-800">{floodDefence}</p>
                                </div>
                            )}
                            {floodLast5Years && (
                                <div className="mb-4 p-3 border border-gray-200 rounded-md bg-white">
                                    <h5 className="text-md font-semibold text-gray-700 mb-1">Flooding in Last 5 Years</h5>
                                    <p className="text-sm text-gray-800">{floodLast5Years}</p>
                                </div>
                            )}
                            {floodSource && (
                                <div className="p-3 border border-gray-200 rounded-md bg-white">
                                    <h5 className="text-md font-semibold text-gray-700 mb-1">Primary Flood Source</h5>
                                    <p className="text-sm text-gray-800">{floodSource}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-gray-500 text-sm">
                            {isDetailedAssessmentUnlocked
                                ? 'Detailed flood risk data is currently unavailable for this property.'
                                : 'Unlock the detailed assessment to view more information.'}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default FloodRiskDisplay; 