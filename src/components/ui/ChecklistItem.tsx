import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isPremiumNoDataValue, PREMIUM_DATA_STATES, PREMIUM_PLACEHOLDER_DESCRIPTIONS, PropertyGroups } from "@/constants/propertyConsts";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { isClickableItemKey } from "@/types/clickableChecklist";
import { DataStatus, EpcConfidenceLevels, PropertyDataList } from "@/types/property";
import React from 'react';
import { FaCheckCircle, FaClock, FaExclamationTriangle, FaInfoCircle, FaLock, FaQuestionCircle, FaThumbsUp, FaTimesCircle, FaUserEdit } from "react-icons/fa";

export interface ChecklistItemProps {
    item: PropertyDataList;
    isSelected: boolean;
    onItemClick?: () => void;
    onValueClick?: () => void;
    isPremiumDataFetched: boolean;
    epcData?: EpcProcessorResult;
    onEpcChange?: (newValue: string) => void;
    epcDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
}

// Mapping DataStatus to styling and icons
const statusStyles: Record<DataStatus, { icon: React.ElementType; color: string }> = {
    [DataStatus.FOUND_POSITIVE]: { icon: FaCheckCircle, color: 'text-green-500' },
    [DataStatus.FOUND_NEGATIVE]: { icon: FaTimesCircle, color: 'text-red-500' },
    [DataStatus.NOT_APPLICABLE]: { icon: FaCheckCircle, color: 'text-gray-500' },
    [DataStatus.ASK_AGENT]: { icon: FaQuestionCircle, color: 'text-yellow-500' },
    [DataStatus.IS_LOADING]: { icon: FaClock, color: 'text-blue-500' },
};

// Confidence Icons
const confidenceIcons: Record<(typeof EpcConfidenceLevels)[keyof typeof EpcConfidenceLevels], React.ElementType | null> = {
    [EpcConfidenceLevels.HIGH]: FaThumbsUp,
    [EpcConfidenceLevels.MEDIUM]: FaExclamationTriangle,
    [EpcConfidenceLevels.USER_PROVIDED]: FaUserEdit,
    [EpcConfidenceLevels.NONE]: null,
};

const EPC_RATINGS = ["A", "B", "C", "D", "E", "F", "G"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
    item,
    isSelected,
    onItemClick,
    onValueClick,
    isPremiumDataFetched,
    epcData,
    onEpcChange,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
}) => {
    const { key, label, status, value, toolTipExplainer } = item;

    const isEpcItem = key === 'epc';

    // Check if the URL ends with a known image extension
    const isImageSourceWithUrl =
        isEpcItem &&
        !!epcData?.url &&
        IMAGE_EXTENSIONS.some(ext => epcData.url!.toLowerCase().endsWith(ext));

    // --- Determine Display Status and Icon ---
    const displayStatus = status;
    const { icon: IconComponent, color } = statusStyles[displayStatus] || { icon: FaQuestionCircle, color: 'text-gray-400' };
    const isWarning = displayStatus === DataStatus.ASK_AGENT;

    // Check if this is a premium item without proper data
    const isPremiumField = item.group === PropertyGroups.PREMIUM &&
        (displayStatus === DataStatus.IS_LOADING ||
            !value ||
            (typeof value === 'string' && isPremiumNoDataValue(value)));

    const renderConfidenceIcon = () => {
        if (!isEpcItem || !epcData || !epcData.confidence || epcData.confidence === EpcConfidenceLevels.NONE) {
            return null;
        }
        const ConfidenceIcon = confidenceIcons[epcData.confidence];
        let iconColor = 'text-gray-400'; // Default
        if (epcData.confidence === EpcConfidenceLevels.HIGH) iconColor = 'text-green-500';
        if (epcData.confidence === EpcConfidenceLevels.MEDIUM) iconColor = 'text-yellow-500';
        if (epcData.confidence === EpcConfidenceLevels.USER_PROVIDED) iconColor = 'text-blue-500';

        return ConfidenceIcon ? <ConfidenceIcon className={`ml-2 w-3 h-3 ${iconColor}`} title={`Confidence: ${epcData.confidence}`} /> : null;
    };

    const renderValue = () => {
        const isClickable = isClickableItemKey(key)
            && value !== "Not mentioned"
            && displayStatus !== DataStatus.IS_LOADING;

        // If it's a premium item without a value yet, show the premium placeholder
        if (isPremiumField && !isPremiumDataFetched) {
            const premiumDescription = PREMIUM_PLACEHOLDER_DESCRIPTIONS[key] || `${label}: Unlock with Premium`;
            return (
                <div className="flex items-center text-gray-500">
                    <FaLock className="mr-2" size={12} />
                    <span>{premiumDescription}</span>
                </div>
            );
        }

        // Special case floor plan - always show as "Yes" when clickable
        if ((key === "floorPlan") && value !== "Not mentioned") {
            return (
                <span
                    onClick={onValueClick}
                    className="cursor-pointer text-blue-500 underline"
                >
                    Yes
                </span>
            );
        }

        if (isEpcItem) {
            const canEditEpc = onEpcChange && epcData &&
                epcData.confidence !== EpcConfidenceLevels.HIGH &&
                epcData.confidence !== EpcConfidenceLevels.USER_PROVIDED;

            const epcValueToDisplay = epcData?.value ?? value ?? "N/A";

            if (canEditEpc && !epcData.isLoading) {
                return (
                    <div className="flex items-center">
                        <Select onValueChange={onEpcChange} defaultValue={epcData?.value ?? undefined}>
                            <SelectTrigger className="h-7 text-xs px-2 w-[80px]">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {EPC_RATINGS.map(rating => (
                                    <SelectItem key={rating} value={rating} className="text-xs">
                                        {rating}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {renderConfidenceIcon()}
                    </div>
                );
            }

            // Non-editable EPC display - No onClick needed
            return (
                <span
                    className={`flex items-center`}
                    style={{ display: 'inline-flex' }}
                >
                    {epcValueToDisplay}
                    {renderConfidenceIcon()}
                </span>
            );
        }

        // For crimeScore, we expect a clickable link that toggles inline expansion
        if (key === "crimeScore" && !isPremiumField) {
            return (
                <span
                    onClick={onValueClick}
                    className={`${displayStatus !== DataStatus.IS_LOADING ? "cursor-pointer text-blue-500 underline" : ""}`}
                >
                    {value || "Not found"}
                </span>
            );
        }

        // For planningPermissions and nearbyPlanningPermissions
        if ((key === "planningPermissions" || key === "nearbyPlanningPermissions") && isClickable && !isPremiumField) {
            // Don't make it clickable if no applications found
            const noApplicationsFound =
                value === PREMIUM_DATA_STATES.NO_APPLICATIONS ||
                value === PREMIUM_DATA_STATES.NO_NEARBY_APPLICATIONS;

            if (noApplicationsFound) {
                return <span>{value}</span>;
            }

            return (
                <span
                    onClick={onValueClick}
                    className="cursor-pointer text-blue-500 underline"
                >
                    {value || "Not found"}
                </span>
            );
        }

        // Log warning if this is a clickable key but we don't have specific rendering for it
        if (isClickableItemKey(key) && !isPremiumField &&
            key !== "epc" && key !== "floorPlan" &&
            key !== "crimeScore" && key !== "planningPermissions" &&
            key !== "nearbyPlanningPermissions") {
            console.warn(`Key "${key}" is defined as clickable but has no special rendering in ChecklistItem`);
        }

        return <span>{value || "Not found"}</span>;
    };

    return (
        <li
            onClick={onItemClick}
            className={`grid grid-cols-[1rem_90px_1fr_2rem] items-center p-2 ${isPremiumField ? 'bg-gray-50 border border-gray-200' : 'bg-gray-100'} rounded-md my-1 ${isWarning ? "border border-yellow-400" : ""
                } ${isSelected ? "" : "opacity-30"}`}
        >
            <div className="flex items-center justify-start">
                <IconComponent className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex items-center ml-2">
                <span>{label}</span>
            </div>
            <div className="text-gray-800 ml-4 flex items-center">{renderValue()}</div>
            <div className="flex items-center justify-center ml-4">
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <button className="p-1 -m-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400">
                                <FaInfoCircle className="cursor-pointer text-gray-500" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="w-[200px] whitespace-pre-line">
                            {toolTipExplainer}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Render Debug Canvas if debug mode is ON (independent of source) */}
            {isEpcDebugModeOn && isEpcItem && epcDebugCanvasRef && (
                <div className="col-span-4" style={{ marginTop: '10px', border: '1px solid grey', overflow: 'auto' }}>
                    <canvas
                        ref={epcDebugCanvasRef}
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                    />
                </div>
            )}

            {/* Image Graph - Render based only on isImageSourceWithUrl */}
            {isImageSourceWithUrl && epcData?.displayUrl && (
                <div className="col-span-4" style={{ marginTop: '10px', border: '1px dashed blue', padding: '5px' }}>
                    <img
                        src={epcData.displayUrl}
                        alt="EPC Graph"
                        style={{ maxWidth: '100%', display: 'block' }}
                        onError={(e) => (e.currentTarget.alt = 'Could not display fetched EPC graph image')}
                    />
                </div>
            )}
        </li>
    );
};