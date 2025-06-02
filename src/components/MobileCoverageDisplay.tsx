import { ProcessedMobileServiceCoverageWithScoreAndLabel } from "@/types/premiumStreetData";
import { getMobileCoverageLabel } from "@/utils/mobileCoverageHelpers";
import React from "react";

interface MobileCoverageDisplayProps {
    mobileCoverage: ProcessedMobileServiceCoverageWithScoreAndLabel;
}

export const MobileCoverageDisplay = ({ mobileCoverage }: MobileCoverageDisplayProps) => {
    const { mobileServiceCoverageArray } = mobileCoverage;

    if (!mobileCoverage || mobileServiceCoverageArray.length === 0) {
        return <div className="text-gray-500">No mobile coverage data available.</div>;
    }

    return (
        <div className="space-y-4">
            {mobileServiceCoverageArray.map((coverage, index) => {
                const networkName = coverage.network || `Network ${index}`;
                return (
                    <div key={networkName} className="border-b border-gray-200 last:border-b-0 pb-4 mb-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="font-semibold text-gray-800">{networkName}</div>
                            <div className="font-semibold text-gray-600 text-center">Indoor</div>
                            <div className="font-semibold text-gray-600 text-center">Outdoor</div>

                            <div className="font-medium text-gray-700">Data 4G</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.data_indoor_4g)}</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.data_outdoor_4g)}</div>

                            <div className="font-medium text-gray-700">Data (Older Networks)</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.data_indoor_no_4g)}</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.data_outdoor_no_4g)}</div>

                            <div className="font-medium text-gray-700">Voice 4G</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.voice_indoor_4g)}</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.voice_outdoor_4g)}</div>

                            <div className="font-medium text-gray-700">Voice (Older Networks)</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.voice_indoor_no_4g)}</div>
                            <div className="text-center text-gray-600">{getMobileCoverageLabel(coverage.voice_outdoor_no_4g)}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}; 