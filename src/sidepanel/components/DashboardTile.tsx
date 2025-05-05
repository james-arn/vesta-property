import { Card, CardContent } from '@/components/ui/card';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { Info } from 'lucide-react';
import React from 'react';

interface DashboardTileProps {
    title: string;
    scoreValue: number | null;
    tooltipContent: React.ReactNode;
}

export const DashboardTile: React.FC<DashboardTileProps> = ({ title, scoreValue, tooltipContent }) => {
    return (
        <Card className="flex flex-col p-2 relative rounded-none">
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground absolute top-2 right-2 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                        {tooltipContent}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <CardContent className="flex-grow flex items-center justify-center p-1">
                <ScoreGauge score={scoreValue} label={title} size={150} />
            </CardContent>
        </Card>
    );
}; 