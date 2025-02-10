import { Skeleton } from "@/components/ui/Skeleton/skeleton";
import React from "react";

const SettingsBarSkeleton = () => <Skeleton className="h-16 w-full" />;

const AccordionHeaderSkeleton = () => (
    <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-6 w-[20px]" />
    </div>
);

const AccordionListSkeleton = () => (
    <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
    </div>
);

const AccordionItemSkeleton = () => (
    <div>
        <AccordionHeaderSkeleton />
        <AccordionListSkeleton />
    </div>
);

const SideBarLoading = () => {
    return (
        <div className="p-4 space-y-4">
            <SettingsBarSkeleton />
            <AccordionItemSkeleton />
            <AccordionItemSkeleton />
            <AccordionItemSkeleton />
        </div>
    );
};

export default SideBarLoading;
