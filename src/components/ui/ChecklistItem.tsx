import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { ENV_CONFIG } from "@/constants/environmentConfig";
import { PREMIUM_DATA_STATES, PREMIUM_LOCKED_DESCRIPTIONS } from "@/constants/propertyConsts";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { isClickableItemKey } from "@/types/clickableChecklist";
import { ConfidenceLevels, DataStatus, PropertyDataListItem } from "@/types/property";
import React from 'react';
import { FaCheckCircle, FaClock, FaExclamationTriangle, FaInfoCircle, FaLock, FaQuestionCircle, FaSearch, FaThumbsUp, FaTimesCircle, FaUserEdit } from "react-icons/fa";

export interface ChecklistItemProps {
    item: PropertyDataListItem;
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
const confidenceIcons: Record<(typeof ConfidenceLevels)[keyof typeof ConfidenceLevels], React.ElementType | null> = {
    [ConfidenceLevels.HIGH]: FaThumbsUp,
    [ConfidenceLevels.MEDIUM]: FaExclamationTriangle,
    [ConfidenceLevels.USER_PROVIDED]: FaUserEdit,
    [ConfidenceLevels.NONE]: null,
};

const EPC_RATINGS = ["A", "B", "C", "D", "E", "F", "G"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
    item,
    onItemClick,
    onValueClick,
    isPremiumDataFetched,
    epcData,
    onEpcChange,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
}) => {
    const { key, label, status, value, toolTipExplainer, isUnlockedWithPremium, isBoostedWithPremium } = item;

    const isEpcItem = key === 'epc';

    const isLocked = isUnlockedWithPremium && !isPremiumDataFetched;
    // Determine if the initial value is meaningful using the constant
    const valueIsMeaningless = !item.value ||
        (typeof item.value === 'string' && (Object.values(CHECKLIST_NO_VALUE) as string[]).includes(item.value));
    // Show boost only if boostable, not locked, and the initial value is meaningless
    const showBoost = isBoostedWithPremium && !isLocked && valueIsMeaningless;
    const canUpgrade = !isPremiumDataFetched;
    const upgradeUrl = ENV_CONFIG.AUTH_PRICING_URL;

    const handleUpgradeClick = () => {
        if (upgradeUrl) {
            window.open(upgradeUrl, '_blank');
        }
    };

    // Check if the URL ends with a known image extension
    const isImageSourceWithUrl =
        isEpcItem &&
        !!epcData?.url &&
        IMAGE_EXTENSIONS.some(ext => epcData.url!.toLowerCase().endsWith(ext));

    // --- Determine Display Status and Icon ---
    const displayStatus = status;
    const { icon: IconComponent, color } = statusStyles[displayStatus] || { icon: FaQuestionCircle, color: 'text-gray-400' };
    const isWarning = displayStatus === DataStatus.ASK_AGENT && !isLocked;

    const renderConfidenceIcon = () => {
        if (!isEpcItem || !epcData || !epcData.confidence || epcData.confidence === ConfidenceLevels.NONE) {
            return null;
        }
        const ConfidenceIcon = confidenceIcons[epcData.confidence];
        let iconColor = 'text-gray-400'; // Default
        if (epcData.confidence === ConfidenceLevels.HIGH) iconColor = 'text-green-500';
        if (epcData.confidence === ConfidenceLevels.MEDIUM) iconColor = 'text-yellow-500';
        if (epcData.confidence === ConfidenceLevels.USER_PROVIDED) iconColor = 'text-blue-500';

        const tooltipText = `Confidence: ${epcData.confidence}${(epcData.confidence !== ConfidenceLevels.HIGH &&
            epcData.confidence !== ConfidenceLevels.USER_PROVIDED &&
            isImageSourceWithUrl)
            ? '. Please double check against the EPC image and correct if necessary'
            : ''
            }`;

        return ConfidenceIcon ? <ConfidenceIcon className={`ml-2 w-3 h-3 ${iconColor}`} title={tooltipText} /> : null;
    };

    const renderValue = () => {
        const isClickable = isClickableItemKey(key)
            && value !== CHECKLIST_NO_VALUE.NOT_MENTIONED
            && displayStatus !== DataStatus.IS_LOADING;

        // If it's a premium item without a value yet, show the premium placeholder
        if (isLocked) {
            const lockedDescription = PREMIUM_LOCKED_DESCRIPTIONS[key] || `Unlock ${label} with Premium`;
            return (
                <div className="flex items-center text-gray-500">
                    <FaLock className="mr-2" size={12} />
                    <span>{lockedDescription}</span>
                </div>
            );
        }

        // Special case floor plan - always show as "Yes" when clickable
        if ((key === "floorPlan") && value !== CHECKLIST_NO_VALUE.NOT_MENTIONED) {
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
                epcData.confidence !== ConfidenceLevels.HIGH &&
                epcData.confidence !== ConfidenceLevels.USER_PROVIDED;

            const epcValueToDisplay = epcData?.value ?? value ?? "N/A";

            if (canEditEpc && !epcData.isLoading) {
                return (
                    <div className="flex items-center">
                        <Select onValueChange={onEpcChange} defaultValue={epcData?.value ?? undefined}>
                            <SelectTrigger className="h-7 text-xs px-2 w-[60px]">
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
        if (key === "crimeScore" && !isLocked) {
            return (
                <span
                    onClick={onValueClick}
                    className={`${displayStatus !== DataStatus.IS_LOADING ? "cursor-pointer text-blue-500 underline" : ""}`}
                >
                    {value || CHECKLIST_NO_VALUE.NOT_FOUND}
                </span>
            );
        }

        // For planningPermissions and nearbyPlanningPermissions
        if ((key === "planningPermissions" || key === "nearbyPlanningPermissions") && isClickable && !isLocked) {
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
        if (isClickableItemKey(key) && !isLocked &&
            key !== "epc" && key !== "floorPlan" &&
            key !== "crimeScore" && key !== "planningPermissions" &&
            key !== "nearbyPlanningPermissions") {
            console.warn(`Key "${key}" is defined as clickable but has no special rendering in ChecklistItem`);
        }

        return <span>{value || CHECKLIST_NO_VALUE.NOT_FOUND}</span>;
    };

    return (
        <li
            className={`grid grid-cols-[1rem_1fr_1fr_auto] items-center p-2 bg-gray-100 rounded-md my-1 ${isWarning ? "border border-yellow-400" : ""}`}
        >
            <div className="flex items-center justify-start">
                <IconComponent className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex items-center ml-2">
                <span>{label}</span>
            </div>
            <div className="text-gray-800 ml-4 flex items-center">{renderValue()}</div>
            <div className="flex items-center justify-end ml-4 space-x-1">
                {showBoost && (
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={canUpgrade ? handleUpgradeClick : undefined}
                                    className={`p-0.5 rounded-full ${canUpgrade ? 'cursor-pointer hover:bg-yellow-100' : ''} focus:outline-none focus:ring-1 focus:ring-yellow-400`}
                                    aria-label={canUpgrade ? "Find out more with Premium" : "Premium deep dive available"}
                                >
                                    <FaSearch className="w-3 h-3 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="max-w-xs">
                                Find out in a deep dive with Premium.{canUpgrade ? ' Click to find out more' : ''}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <button className="p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400">
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