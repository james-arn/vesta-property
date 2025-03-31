import { Card, CardContent } from "@/components/ui/card";
import { NearbyPlanningApplication, PlanningApplication } from "@/types/premiumStreetData";
import React from "react";

export type PlanningPermissionDisplayMode = 'property' | 'nearby';

interface PlanningPermissionCardProps {
    planningPermissionData?: PlanningApplication[] | null | undefined;
    nearbyPlanningPermissionData?: NearbyPlanningApplication[] | null | undefined;
    isLoading: boolean;
    displayMode: PlanningPermissionDisplayMode;
}

type AnyPlanningApplication = PlanningApplication | NearbyPlanningApplication;

const PlanningPermissionCard: React.FC<PlanningPermissionCardProps> = ({
    planningPermissionData,
    nearbyPlanningPermissionData,
    displayMode
}) => {
    const renderField = (label: string, value: string | null) => {
        if (value === null) return null;
        return (
            <div className="mb-1">
                <span className="font-semibold">{label}:</span> {value}
            </div>
        );
    };

    const renderPlanningApplication = (application: AnyPlanningApplication, isNearby: boolean) => (
        <li key={application.reference_number} className="mb-6 pb-4 border-b last:border-b-0">
            <a
                href={application.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline text-base block mb-2"
            >
                {application.reference_number}
            </a>

            {application.status && (
                <div className="flex items-center mb-2">
                    <span className="font-semibold mr-1">Status:</span>
                    {application.status}
                    <span className="ml-1">
                        {application.status.toLowerCase().includes("awaiting") ? "⚠️" : "✅"}
                    </span>
                </div>
            )}

            <div className="mb-3">
                <p>{application.description}</p>
            </div>

            {renderField("Validated Date", application.validated_date)}
            {renderField("Decision", application.decision)}
            {renderField("Decision Date", application.decision_date)}
            {renderField("Received Date", application.received_date)}
            {renderField("Appeal Status", application.appeal_status)}
            {renderField("Appeal Decision", application.appeal_decision)}

            {'distance_in_metres' in application && isNearby && (
                <div className="mt-2">
                    {renderField("Address", application.address)}
                    {renderField("Postcode", application.postcode)}
                    {renderField("Council", application.council)}
                    {renderField("Distance", `${application.distance_in_metres} metres`)}
                </div>
            )}
        </li>
    );

    const renderPlanningSection = (
        title: string,
        applications: AnyPlanningApplication[] | null | undefined,
        isNearby: boolean
    ) => (
        <div className="mb-4">
            <h3 className="text-xl font-bold mb-3">{title}</h3>
            {applications && applications.length > 0 ? (
                <ul className="space-y-1">
                    {applications.map(application => renderPlanningApplication(application, isNearby))}
                </ul>
            ) : (
                <p className="text-gray-500">No applications found</p>
            )}
        </div>
    );

    return (
        <Card className="flex flex-col w-full">
            <CardContent className="p-4">
                {displayMode === 'property' &&
                    renderPlanningSection(
                        "Property Planning Applications",
                        planningPermissionData,
                        false
                    )
                }
                {displayMode === 'nearby' &&
                    renderPlanningSection(
                        "Nearby Planning Applications",
                        nearbyPlanningPermissionData,
                        true
                    )
                }
            </CardContent>
        </Card>
    );
};

export default PlanningPermissionCard;