import {
    CoastalErosionEstimatedDistanceLost,
    CoastalErosionEstimatedDistanceLostTerm,
    CoastalErosionPlan
} from '@/types/premiumStreetData';
import { CoastalErosionDataForChecklist } from '@/types/property';
import React from 'react';
import { BsShieldFillCheck, BsShieldFillExclamation } from 'react-icons/bs';
import { HiExclamation, HiShieldCheck } from 'react-icons/hi';
import { MdInfo, MdLocationOn, MdOutlineWaterDrop } from 'react-icons/md';
import { TbBeach, TbCalendarTime } from 'react-icons/tb';

const Icon = {
    NoRisk: () => <BsShieldFillCheck className="w-5 h-5 text-green-500" />,
    Warning: () => <BsShieldFillExclamation className="w-5 h-5 text-yellow-500" />,
    HighRisk: () => <HiExclamation className="w-5 h-5 text-red-500" />,
    Info: () => <MdInfo className="w-5 h-5 text-blue-500" />,
    Defence: () => <HiShieldCheck className="w-5 h-5 text-gray-600" />,
    Location: () => <MdLocationOn className="w-5 h-5 text-gray-600" />,
    Calendar: () => <TbCalendarTime className="w-5 h-5 text-gray-600" />,
    Flood: () => <MdOutlineWaterDrop className="w-5 h-5 text-gray-600" />,
    Beach: () => <TbBeach className="w-5 h-5 text-gray-600" />
};

interface CoastalErosionDisplayProps {
    coastalErosionDetails: CoastalErosionDataForChecklist | null;
}

const getRiskRatingClasses = (rating: string | null | undefined): string => {
    switch (rating?.toLowerCase()) {
        case 'no risk':
            return 'text-green-600 bg-green-100';
        case 'low risk':
            return 'text-yellow-600 bg-yellow-100';
        case 'medium risk':
            return 'text-orange-600 bg-orange-100';
        case 'high risk':
            return 'text-red-600 bg-red-100';
        default:
            return 'text-gray-600 bg-gray-100';
    }
};

const hasActualData = (data: CoastalErosionEstimatedDistanceLost | null): boolean => {
    return !!(data?.short_term || data?.medium_term || data?.long_term);
};

const RiskTermDisplay: React.FC<{ termData: CoastalErosionEstimatedDistanceLostTerm | null, termName: string }> = ({ termData, termName }) => {
    if (!termData) return <p className="text-sm text-gray-500">{termName}: Not available.</p>;

    const riskRatingClasses = getRiskRatingClasses(termData.risk?.risk_rating);

    return (
        <div className="mb-3 p-3 border border-gray-200 rounded-md bg-white">
            <h4 className="font-semibold text-md text-gray-700">{termName} ({termData.risk?.risk_rating || 'N/A'})</h4>
            {termData.risk?.risk_rating && (
                <p className={`text-sm font-medium px-2 py-1 inline-block rounded ${riskRatingClasses}`}>
                    Risk: {termData.risk.risk_rating}
                </p>
            )}
            <p className="text-sm text-gray-600">Average Estimated Erosion: {termData.average_estimated_value ?? 'N/A'}m</p>
            <p className="text-sm text-gray-600">
                Range: {termData.estimated_value_lower_bound ?? 'N/A'}m - {termData.estimated_value_upper_bound ?? 'N/A'}m
            </p>
        </div>
    );
};

const EstimatedDistanceLostDisplay: React.FC<{ data: CoastalErosionEstimatedDistanceLost | null }> = ({ data }) => {
    if (!data) return <p className="text-sm text-gray-500">Erosion estimates not available.</p>;
    return (
        <div className="mt-2 space-y-2">
            <RiskTermDisplay termData={data.short_term} termName="Short Term (0-20 years)" />
            <RiskTermDisplay termData={data.medium_term} termName="Medium Term (20-50 years)" />
            <RiskTermDisplay termData={data.long_term} termName="Long Term (50-100 years)" />
        </div>
    );
};

const CoastalErosionPlanDisplay: React.FC<{ plan: CoastalErosionPlan }> = ({ plan }) => (
    <div className="mb-6 p-4 border border-gray-300 rounded-lg shadow-sm bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Coastal Feature Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
                <Icon.Info />
                <span>Feature ID: {plan.feature_id || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Icon.Beach />
                <span>Feature Type: {plan.feature_type || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Icon.Defence />
                <span>Defence Type: {plan.defence_type || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Icon.Flood />
                <span>Floodable: {plan.floodable === null ? 'N/A' : plan.floodable ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Icon.Location />
                <span>Distance from Property: {plan.distance_from_point === null ? 'N/A' : `${plan.distance_from_point}m`}</span>
            </div>
        </div>

        {plan.shore_management_plan && hasActualData(plan.shore_management_plan.estimated_distance_lost) && (
            <div className="mt-4 pt-3 border-t border-gray-200">
                <h4 className="text-md font-semibold text-gray-700 mb-1">
                    With Shore Management Plan: {plan.shore_management_plan.name || 'Unnamed Plan'}
                    {plan.shore_management_plan.id && ` (ID: ${plan.shore_management_plan.id})`}
                </h4>
                <EstimatedDistanceLostDisplay data={plan.shore_management_plan.estimated_distance_lost} />
            </div>
        )}

        {plan.no_active_intervention && (
            <div className="mt-4 pt-3 border-t border-gray-200">
                <h4 className="text-md font-semibold text-gray-700 mb-1">Without Active Intervention</h4>
                <EstimatedDistanceLostDisplay data={plan.no_active_intervention.estimated_distance_lost} />
            </div>
        )}
        {plan.meta && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                <ul className="list-disc ml-4 space-y-1">
                    {plan.meta.data_type && (
                        <li>Data type: {plan.meta.data_type}</li>
                    )}
                    {plan.meta.source && (
                        <li>Source: {plan.meta.source}</li>
                    )}
                </ul>
            </div>
        )}
    </div>
);

const CoastalErosionDisplay: React.FC<CoastalErosionDisplayProps> = ({ coastalErosionDetails }) => {
    if (!coastalErosionDetails) {
        return <div className="p-4 text-gray-500">Loading coastal erosion data...</div>;
    }

    const { detailsForAccordion } = coastalErosionDetails;

    if (!detailsForAccordion) {
        return (
            <div className="p-4 flex items-center text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
                <Icon.Warning />
                <span className="ml-2">Coastal erosion data is currently unavailable.</span>
            </div>
        );
    }

    const { can_have_erosion_plan, plans } = detailsForAccordion;

    if (can_have_erosion_plan === false) {
        return (
            <div className="p-4 flex items-center text-green-700 bg-green-50 border border-green-200 rounded-md">
                <Icon.NoRisk />
                <span className="ml-2">No Coastal Erosion Risk: This property is not in an area identified as at risk of coastal erosion.</span>
            </div>
        );
    }

    // If can_have_erosion_plan is true or null (treat null as potentially at risk)
    return (
        <div>
            {can_have_erosion_plan === null && (
                <div className="p-3 flex items-center text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
                    <Icon.Info />
                    <span className="ml-2">The property's specific coastal erosion risk status (can_have_erosion_plan) is undetermined, showing available plan details.</span>
                </div>
            )}
            {(!plans || plans.length === 0) && (
                <div className="p-3 flex items-center text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md">
                    <Icon.Warning />
                    <span className="ml-2">This property is in an area where coastal erosion can occur, but detailed plans are not available.</span>
                </div>
            )}
            {plans && plans.length > 0 && (
                <div className="space-y-6">
                    {plans.map((plan, index) => (
                        <CoastalErosionPlanDisplay key={plan.feature_id || index} plan={plan} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default CoastalErosionDisplay;