import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { CHECKLIST_KEYS } from "@/constants/checklistKeys";
import { PREMIUM_DATA_STATES, PREMIUM_LOCKED_DESCRIPTIONS } from "@/constants/propertyConsts";
import { useAccordion } from "@/hooks/useAccordion";
import { checkIfClickableItemKey } from "@/types/clickableChecklist";
import { EpcBandResult } from "@/types/epc";
import { DataStatus, PropertyDataListItem } from "@/types/property";
import React, { useEffect } from 'react';
import { FaCheckCircle, FaClock, FaInfoCircle, FaQuestionCircle, FaSearch, FaTimesCircle } from "react-icons/fa";
import { MobileCoverageDisplay } from "../MobileCoverageDisplay";
import { EpcChecklistItem } from "./EpcChecklistItem";

export interface ChecklistItemProps {
    item: PropertyDataListItem;
    onItemClick?: () => void;
    onValueClick?: () => void;
    isPremiumDataFetched: boolean;
    epcBandData?: EpcBandResult | undefined;
    onEpcChange?: (newValue: string) => void;
    epcDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    isEpcDebugModeOn: boolean;
    onOpenUpsellModal?: () => void;
    mobileCoverageAccordion?: ReturnType<typeof useAccordion>;
}

const statusStyles: Record<DataStatus, { icon: React.ElementType; color: string }> = {
    [DataStatus.FOUND_POSITIVE]: { icon: FaCheckCircle, color: 'text-green-500' },
    [DataStatus.FOUND_NEGATIVE]: { icon: FaTimesCircle, color: 'text-red-500' },
    [DataStatus.NOT_APPLICABLE]: { icon: FaCheckCircle, color: 'text-gray-500' },
    [DataStatus.ASK_AGENT]: { icon: FaQuestionCircle, color: 'text-yellow-500' },
    [DataStatus.IS_LOADING]: { icon: FaClock, color: 'text-blue-500' },
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
    item,
    onItemClick,
    onValueClick,
    isPremiumDataFetched,
    epcBandData,
    onEpcChange,
    epcDebugCanvasRef,
    isEpcDebugModeOn,
    onOpenUpsellModal,
    mobileCoverageAccordion,
}) => {
    const { key, label, status, value, toolTipExplainer, isExpectedInPremiumSearchData: hasPremiumFeature, epcImageUrl } = item;

    const isEpcItem = key === CHECKLIST_KEYS.EPC;

    const valueIsMeaningless = !item.value ||
        (typeof item.value === 'string' &&
            ((Object.values(CHECKLIST_NO_VALUE) as string[]).includes(item.value) ||
                (Object.values(PREMIUM_DATA_STATES) as string[]).includes(item.value)));

    const showPremiumIndicator = !isPremiumDataFetched && hasPremiumFeature;

    const isImageSourceWithUrl =
        isEpcItem &&
        !!epcImageUrl &&
        (epcImageUrl.toLowerCase().startsWith("data:image/") ||
            IMAGE_EXTENSIONS.some(ext => epcImageUrl.toLowerCase().endsWith(ext)));

    const displayStatus = status;
    const { icon: IconComponent, color } = statusStyles[displayStatus] || { icon: FaQuestionCircle, color: 'text-gray-400' };
    const isEffectivelyLocked = showPremiumIndicator && valueIsMeaningless;
    const isWarning = displayStatus === DataStatus.ASK_AGENT && !isEffectivelyLocked;

    useEffect(() => {
        const canvas = epcDebugCanvasRef?.current;
        const bands = epcBandData;
        const imageUrlToDraw = epcImageUrl;

        if (isEpcItem && isEpcDebugModeOn && canvas && imageUrlToDraw && bands) {
            console.log("[ChecklistItem.tsx] Debug EPC: Drawing to canvas.");
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = "12px Arial";
                ctx.fillStyle = "black";
                ctx.fillText(`Img: ${imageUrlToDraw.substring(0, 30)}...`, 10, 20);
                ctx.fillText(`Current: ${bands.currentBand?.letter}, Score: ${bands.currentBand?.score}`, 10, 40);
                ctx.fillText(`Potential: ${bands.potentialBand?.letter}, Score: ${bands.potentialBand?.score}`, 10, 60);
                if (bands.error) {
                    ctx.fillStyle = "red";
                    ctx.fillText(`Error: ${bands.error}`, 10, 80);
                }
            }
        } else if (isEpcItem && isEpcDebugModeOn && canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = "12px Arial";
                ctx.fillStyle = "orange";
                if (!imageUrlToDraw) ctx.fillText("EPC Debug: No image URL for canvas.", 10, 20);
                else if (!bands) ctx.fillText("EPC Debug: No band data for canvas.", 10, 20);
            }
        }
    }, [isEpcItem, isEpcDebugModeOn, epcDebugCanvasRef, epcImageUrl, epcBandData]);

    const renderValue = () => {
        const isClickableItemKey = checkIfClickableItemKey(key)
            && value !== CHECKLIST_NO_VALUE.NOT_MENTIONED
            && displayStatus !== DataStatus.IS_LOADING;

        if (showPremiumIndicator && valueIsMeaningless) {
            const lockedDescription = PREMIUM_LOCKED_DESCRIPTIONS[key] || `View details with Premium`;
            return (
                <div className="flex items-center text-gray-500">
                    <span
                        onClick={onOpenUpsellModal}
                        className="cursor-pointer hover:underline"
                    >
                        {lockedDescription}
                    </span>
                </div>
            );
        }

        if (key === CHECKLIST_KEYS.PUBLIC_RIGHT_OF_WAY) {
            const details = item.publicRightOfWay;
            if (details && details.exists === true) {
                const hasDetails = details.distance !== null ||
                    details.date_updated !== null ||
                    details.parish !== null ||
                    details.route_no !== null ||
                    details.row_type !== null;

                if (hasDetails) {
                    return (
                        <div className="text-xs text-gray-600 flex flex-col space-y-0.5">
                            <span>Yes</span>
                            {details.row_type && <span>Type: {details.row_type}</span>}
                            {details.distance !== null && <span>Distance: {details.distance}m</span>}
                            {details.route_no && <span>Route No: {details.route_no}</span>}
                            {details.parish && <span>Parish: {details.parish}</span>}
                            {details.date_updated && <span>Updated: {details.date_updated}</span>}
                        </div>
                    );
                }
                return <span>Yes</span>;
            }
            return <span>{item.value}</span>;
        }

        else if (key === CHECKLIST_KEYS.MOBILE_COVERAGE && !isEffectivelyLocked) {
            const overallLabel = item.mobileCoverage?.mobileCoverageLabel;
            return (
                <div className="w-full">
                    <div className="flex items-center justify-between w-full cursor-pointer cursor-pointer text-blue-500 underline" onClick={() => onValueClick?.()}>
                        <span >{overallLabel}</span>
                    </div>
                    {mobileCoverageAccordion?.isExpanded && (
                        <div
                            ref={mobileCoverageAccordion.contentRef}
                            style={{ height: mobileCoverageAccordion.contentHeight, overflow: 'hidden', transition: 'height 0.3s ease' }}
                            className="mt-2"
                        >
                            {Array.isArray(item.mobileCoverage?.mobileServiceCoverageArray) &&
                                item.mobileCoverage?.mobileServiceCoverageArray.length > 0 && (
                                    <div className="mt-1">
                                        <MobileCoverageDisplay mobileCoverage={item.mobileCoverage} />
                                    </div>
                                )}
                        </div>
                    )}
                </div>
            );
        }

        else if (key === CHECKLIST_KEYS.RESTRICTIVE_COVENANTS) {
            const covenants = item.restrictiveCovenants;

            if (Array.isArray(covenants) && covenants.length > 0) {
                return (
                    <div className="min-w-0 flex flex-col space-y-2 text-xs">
                        {covenants.map((covenant, index) => (
                            <div key={covenant.unique_identifier || index} className={`pt-1 ${index > 0 ? 'border-t border-gray-200 mt-1' : ''}`}>
                                {
                                    covenant.associated_property_description && (
                                        <div>
                                            <span className="font-semibold">Description:</span>
                                            <span className="ml-1 break-words">{covenant.associated_property_description}</span>
                                        </div>
                                    )
                                }
                                {
                                    covenant.unique_identifier && (
                                        <div className="mt-0.5">
                                            <span className="font-semibold">Identifier:</span>
                                            <span className="ml-1 font-mono text-[11px] break-words">{covenant.unique_identifier}</span>
                                        </div>
                                    )
                                }
                                {
                                    !covenant.associated_property_description && !covenant.unique_identifier && (
                                        <span>Details unavailable for this covenant.</span>
                                    )
                                }
                            </div>
                        ))}
                    </div>
                );
            }
            return <span>{item.value}</span>;
        }

        if ((key === CHECKLIST_KEYS.FLOOR_PLAN) && value !== CHECKLIST_NO_VALUE.NOT_MENTIONED) {
            return (
                <span
                    onClick={() => onValueClick?.()}
                    className="cursor-pointer text-blue-500 underline"
                >
                    Yes
                </span>
            );
        }

        if (isEpcItem) {
            return (
                <EpcChecklistItem
                    value={value as string | null | undefined}
                    confidence={item.confidence}
                    epcSource={item.epcSource}
                    onEpcChange={onEpcChange}
                    isImageSourceWithUrl={isImageSourceWithUrl}
                />
            );
        }

        if (key === CHECKLIST_KEYS.CRIME_SCORE && !isEffectivelyLocked) {
            return (
                <span
                    onClick={() => onValueClick?.()}
                    className={`${displayStatus !== DataStatus.IS_LOADING ? "cursor-pointer text-blue-500 underline" : ""}`}
                >
                    {value || CHECKLIST_NO_VALUE.NOT_FOUND}
                </span>
            );
        }

        if ((key === CHECKLIST_KEYS.PLANNING_PERMISSIONS || key === CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS || key === CHECKLIST_KEYS.MOBILE_COVERAGE) && isClickableItemKey && !isEffectivelyLocked) {
            const isNonClickableState =
                typeof value === "string" &&
                (Object.values(CHECKLIST_NO_VALUE).includes(value as any) ||
                    Object.values(PREMIUM_DATA_STATES).includes(value as any));

            if (isNonClickableState) {
                return <span>{value}</span>;
            }
            return (
                <span
                    onClick={() => onValueClick?.()}
                    className="cursor-pointer text-blue-500 underline"
                >
                    {value || CHECKLIST_NO_VALUE.NOT_FOUND}
                </span>
            );
        }

        if (checkIfClickableItemKey(key) && !isEffectivelyLocked &&
            // @ts-expect-error TS2367: Comparison is intentional to exclude handled clickable keys.
            key !== CHECKLIST_KEYS.EPC && key !== CHECKLIST_KEYS.FLOOR_PLAN &&
            key !== CHECKLIST_KEYS.CRIME_SCORE && key !== CHECKLIST_KEYS.PLANNING_PERMISSIONS &&
            key !== CHECKLIST_KEYS.NEARBY_PLANNING_PERMISSIONS && key !== CHECKLIST_KEYS.MOBILE_COVERAGE) {
            console.warn(`Key "${key}" is defined as clickable but has no special rendering in ChecklistItem`);
        }

        return <span>{item.value || CHECKLIST_NO_VALUE.NOT_FOUND}</span>;
    };

    return (
        <li
            className={`grid grid-cols-[1rem_5rem_1fr_auto] items-center p-2 bg-gray-100 rounded-md my-1 ${isWarning ? "border border-yellow-400" : ""}`}
        >
            <div className="flex items-center justify-start pt-0.5">
                <IconComponent className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex items-center ml-2 pt-0.5">
                <span>{label}</span>
            </div>
            <div className="min-w-0 text-gray-800 ml-4 flex items-center">{renderValue()}</div>
            <div className="flex items-center justify-end ml-4 space-x-1 pt-0.5">
                {showPremiumIndicator && (
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onOpenUpsellModal}
                                    className={`p-0.5 rounded-full cursor-pointer hover:bg-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-400`}
                                    aria-label={PREMIUM_LOCKED_DESCRIPTIONS[key] || "Find out more with Premium"}
                                >
                                    <FaSearch className="w-3 h-3 text-yellow-500" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="max-w-xs">
                                {PREMIUM_LOCKED_DESCRIPTIONS[key] || "More information available with Premium."} Click to find out more.
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

            {isEpcDebugModeOn && isEpcItem && epcDebugCanvasRef && (
                <div className="col-span-4" style={{ marginTop: '10px', border: '1px solid grey', overflow: 'auto' }}>
                    <canvas
                        ref={epcDebugCanvasRef}
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                    />
                </div>
            )}

            {isImageSourceWithUrl && epcImageUrl && (
                <div className="col-span-4" style={{ marginTop: '10px', border: '1px dashed blue', padding: '5px' }}>
                    <img
                        src={epcImageUrl}
                        alt="EPC Graph"
                        style={{ maxWidth: '100%', display: 'block' }}
                        onError={(e) => (e.currentTarget.alt = 'Could not display fetched EPC graph image')}
                    />
                </div>
            )}
        </li>
    );
};