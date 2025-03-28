import { Card, CardContent } from "@/components/ui/card";
import { NearbyPlanningApplication, PlanningApplication } from "@/types/premiumStreetData";
import React from "react";

interface PlanningPermissionCardProps {
    planningPermissionData: PlanningApplication[] | null | undefined;
    nearbyPlanningPermissionData: NearbyPlanningApplication[] | null | undefined;
    isLoading: boolean;
}

const PlanningPermissionCard: React.FC<PlanningPermissionCardProps> = ({
    planningPermissionData,
    nearbyPlanningPermissionData,
}) => {


    return (
        <Card className="flex flex-col">
            <CardContent className="flex-1 pb-0">
                <h3 className="text-md font-bold">Planning Applications</h3>
                <ul className="space-y-2">
                    {planningPermissionData?.map((permission) => (
                        <li key={permission.reference_number} className="border-b pb-2">
                            <a
                                href={permission.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                {permission.reference_number}
                            </a>
                            <div>
                                Status: <strong>{permission.status}</strong>{" "}
                                {permission.status.toLowerCase().includes("awaiting") ? "⚠️" : "✅"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Decision Date: {permission.decision_date || "Not available"}
                            </div>
                        </li>
                    ))}
                </ul>

                <h3 className="text-lg font-bold">Nearby Planning Applications</h3>
                <ul className="space-y-2">
                    {nearbyPlanningPermissionData?.map((nearbyPermission) => (
                        <li key={nearbyPermission.reference_number} className="border-b pb-2">
                            <a
                                href={nearbyPermission.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                {nearbyPermission.reference_number}
                            </a>
                            <div>
                                Status: <strong>{nearbyPermission.status}</strong>{" "}
                                {nearbyPermission.status.toLowerCase().includes("awaiting") ? "⚠️" : "✅"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Decision Date: {nearbyPermission.decision_date || "Not available"}
                            </div>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};

export default PlanningPermissionCard;