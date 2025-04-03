import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ActionEvents } from '@/constants/actionEvents';
import { isPremiumNoDataValue, PREMIUM_DATA_STATES, PREMIUM_PLACEHOLDER_DESCRIPTIONS, PropertyGroups } from "@/constants/propertyConsts";
import { isClickableItemKey } from "@/types/clickableChecklist";
import { DataStatus } from "@/types/property";

import { EpcBandInfo, EpcBandResult, processEpcImageDataUrl } from '@/sidepanel/propertychecklist/epcImageUtils';
import { PropertyDataList } from "@/types/property";
import React, { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaClock, FaInfoCircle, FaLock, FaQuestionCircle, FaTimesCircle } from "react-icons/fa";

export interface ChecklistItemProps {
    item: PropertyDataList;
    isSelected: boolean;
    onItemClick?: () => void;
    onValueClick?: () => void;
    isPremiumDataFetched: boolean;
}

// Mapping DataStatus to styling and icons
const statusStyles: Record<DataStatus, { icon: React.ElementType; color: string }> = {
    [DataStatus.FOUND_POSITIVE]: { icon: FaCheckCircle, color: 'text-green-500' },
    [DataStatus.FOUND_NEGATIVE]: { icon: FaTimesCircle, color: 'text-red-500' },
    [DataStatus.NOT_APPLICABLE]: { icon: FaCheckCircle, color: 'text-gray-500' },
    [DataStatus.ASK_AGENT]: { icon: FaQuestionCircle, color: 'text-yellow-500' },
    [DataStatus.IS_LOADING]: { icon: FaClock, color: 'text-blue-500' },
};

const formatEPCBandInfo = (band: EpcBandInfo | undefined | null): string => {
    if (!band) return 'N/A';
    const rangeMax = typeof band.range.max === 'string' ? band.range.max : band.range.max.toString();
    return `${band.letter} (${band.range.min}-${rangeMax})`;
};

// Add a simple flag for enabling debug mode (you can make this dynamic later)
const IS_EPC_DEBUG_MODE = true;

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
    item,
    isSelected,
    onItemClick,
    onValueClick,
    isPremiumDataFetched
}) => {
    const { key, label, status, value, toolTipExplainer, askAgentMessage } = item;

    // --- State for EPC Async Processing ---
    type EpcProcessingStatus = 'idle' | 'fetching' | 'processing' | 'success' | 'error';
    const [epcProcessingStatus, setEpcProcessingStatus] = useState<EpcProcessingStatus>('idle');
    const [epcResult, setEpcResult] = useState<EpcBandResult | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [epcImageDataUrl, setEpcImageDataUrl] = useState<string | null>(null);

    // --- Ref for mounted status ---
    const isMountedRef = useRef(true);
    // --- Ref for debug canvas ---
    const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // --- State for EPC Image Visibility ---
    const [isEpcImageVisible, setIsEpcImageVisible] = useState(false);

    const isEpcItem = key === 'epc';
    const originalEpcImageUrl = (isEpcItem && typeof value === 'string' && value.startsWith('http')) ? value : null;

    // Function to toggle image visibility
    const toggleEpcImageVisibility = () => {
        if (isEpcItem && originalEpcImageUrl) { // Only toggle if it's an EPC item with a valid URL
            setIsEpcImageVisible(prev => !prev);
        }
    };

    // --- Effect for EPC Processing ---
    useEffect(() => {
        isMountedRef.current = true;

        if (!originalEpcImageUrl) {
            if (epcProcessingStatus !== 'idle') {
                setEpcProcessingStatus('idle');
                setEpcResult(null);
                setFetchError(null);
            }
            return () => {
                isMountedRef.current = false;
            };
        }

        if (epcProcessingStatus === 'idle') {
            setEpcProcessingStatus('fetching');
            setEpcResult(null);
            setFetchError(null);
            console.log(`[ChecklistItem] Requesting fetch for: ${originalEpcImageUrl}`);

            chrome.runtime.sendMessage(
                { action: ActionEvents.FETCH_IMAGE_FOR_CANVAS, url: originalEpcImageUrl },
                (response) => {
                    if (!isMountedRef.current) {
                        console.log("[ChecklistItem] Component unmounted before background response processed.");
                        return;
                    }

                    if (response?.success && response.dataUrl) {
                        console.log(`[ChecklistItem] Received Data URL, starting canvas processing.`);
                        setEpcProcessingStatus('processing');
                        processEpcImageDataUrl(response.dataUrl, debugCanvasRef.current)
                            .then(result => {
                                if (isMountedRef.current) {
                                    setEpcResult(result);
                                    setEpcProcessingStatus(result.error ? 'error' : 'success');
                                }
                            })
                            .catch(error => {
                                console.error(`[ChecklistItem] Canvas processing failed:`, error);
                                if (isMountedRef.current) {
                                    setEpcResult({ error: error?.message || "Canvas processing failed." });
                                    setEpcProcessingStatus('error');
                                }
                            });
                    } else {
                        const errorMsg = response?.error || "Failed to fetch image data.";
                        console.error(`[ChecklistItem] Background fetch failed:`, errorMsg);
                        if (isMountedRef.current) {
                            setFetchError(errorMsg);
                            setEpcProcessingStatus('error');
                        }
                    }
                }
            );
        }

        return () => {
            isMountedRef.current = false;
        };
    }, [originalEpcImageUrl, epcProcessingStatus]);

    // --- Determine Display Status and Icon ---
    let displayStatus = status;
    if (isEpcItem) {
        if (epcProcessingStatus === 'fetching' || epcProcessingStatus === 'processing') displayStatus = DataStatus.IS_LOADING;
        else if (epcProcessingStatus === 'error') displayStatus = DataStatus.ASK_AGENT;
        else if (epcProcessingStatus === 'success' && (epcResult?.currentBand || epcResult?.potentialBand)) displayStatus = DataStatus.FOUND_POSITIVE;
        else if (epcProcessingStatus === 'success') displayStatus = DataStatus.ASK_AGENT;
    }

    const { icon: IconComponent, color } = statusStyles[displayStatus] || { icon: FaQuestionCircle, color: 'text-gray-400' };

    const isWarning = displayStatus === DataStatus.ASK_AGENT;

    // Check if this is a premium item without proper data
    const isPremiumField = item.group === PropertyGroups.PREMIUM &&
        (displayStatus === DataStatus.IS_LOADING ||
            !value ||
            (typeof value === 'string' && isPremiumNoDataValue(value)));

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
            let content: React.ReactNode;
            // Generate the content based on processing status
            if (epcProcessingStatus === 'fetching') {
                content = <span className="italic text-gray-500">Fetching image...</span>;
            } else if (epcProcessingStatus === 'processing') {
                content = <span className="italic text-gray-500">Analysing image...</span>;
            } else if (epcProcessingStatus === 'error') {
                const errorMsg = fetchError || epcResult?.error || "Could not analyse image";
                content = <span className="italic text-red-500">Error: {errorMsg}</span>;
            } else if (epcProcessingStatus === 'success') {
                if (epcResult?.currentBand || epcResult?.potentialBand) {
                    content = (
                        <span>
                            Current: {formatEPCBandInfo(epcResult.currentBand)} | Potential: {formatEPCBandInfo(epcResult.potentialBand)}
                        </span>
                    );
                } else {
                    content = <span className="italic text-yellow-600">Could not determine bands from image.</span>;
                }
            } else { // Idle state
                if (originalEpcImageUrl) {
                    content = (
                        <span className="text-blue-600 hover:underline">
                            Click to analyse / view image
                        </span>
                    );
                } else {
                    content = <span className="italic text-gray-400">{String(value)}</span>; // Show original value if not a URL
                }
            }

            // Wrap the content in a clickable div
            return (
                <div onClick={toggleEpcImageVisibility} style={{ cursor: originalEpcImageUrl ? 'pointer' : 'default' }}>
                    {content}
                </div>
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
            console.error(`Key "${key}" is defined as clickable but has no special rendering in ChecklistItem`);
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
            <div className="text-gray-800 ml-4">{renderValue()}</div>
            <div className="flex items-center justify-center ml-4">
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <FaInfoCircle className="cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="w-[200px] whitespace-pre-line">
                            {toolTipExplainer}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            {/* --- Conditionally render the debug canvas --- */}
            {IS_EPC_DEBUG_MODE && isEpcItem && (
                <div className="col-span-4" style={{ marginTop: '10px', border: '1px solid grey', overflow: 'auto' }}>
                    <canvas
                        ref={debugCanvasRef}
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                    />
                    <p style={{ fontSize: '0.7rem', color: 'grey', padding: '2px 4px', margin: 0 }}>
                        Debug Canvas: Red=Potential Region, Blue=Current Region
                    </p>
                </div>
            )}

            {/* --- Conditionally render the full EPC image using DATA URL --- */}
            {isEpcItem && isEpcImageVisible && epcImageDataUrl && (
                <div className="col-span-4" style={{ marginTop: '10px', border: '1px dashed blue', padding: '5px' }}>
                    <img
                        src={epcImageDataUrl}
                        alt="Full EPC Graph"
                        style={{ maxWidth: '100%', display: 'block' }}
                        onError={(e) => (e.currentTarget.alt = 'Could not display fetched EPC image data')}
                    />
                </div>
            )}
        </li>
    );
};