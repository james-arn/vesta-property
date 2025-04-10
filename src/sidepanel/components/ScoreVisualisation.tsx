import { cn } from '@/lib/utils'; // Assuming you have a utility for class names
import { DashboardScore } from '@/types/property'; // Import the score type
import React from 'react';

interface ScoreVisualisationProps {
    score: DashboardScore;
    lowerIsBetter?: boolean; // Optional flag for scores where lower values are better (e.g., risk)
}

// Function to determine color based on score percentage
const getScoreColor = (percentage: number, lowerIsBetter: boolean = false): string => {
    const effectivePercentage = lowerIsBetter ? 100 - percentage : percentage;
    if (effectivePercentage >= 75) return 'bg-green-500'; // Good
    if (effectivePercentage >= 40) return 'bg-yellow-500'; // Medium
    return 'bg-red-500'; // Bad
};

export const ScoreVisualisation: React.FC<ScoreVisualisationProps> = ({ score, lowerIsBetter = false }) => {
    const { scoreValue, maxScore, scoreLabel } = score;

    // Prevent division by zero and handle invalid scores
    const percentage = maxScore > 0 ? Math.max(0, Math.min(100, (scoreValue / maxScore) * 100)) : 0;
    const barColor = getScoreColor(percentage, lowerIsBetter);

    return (
        <div className="flex items-center space-x-2 w-full" title={`Score: ${scoreValue}/${maxScore}`}>
            <div className="flex-grow h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-500 ease-out", barColor)}
                    style={{ width: `${percentage}%` }}
                    aria-valuenow={scoreValue}
                    aria-valuemin={0}
                    aria-valuemax={maxScore}
                    role="progressbar"
                    aria-label={`${scoreLabel} score: ${scoreValue} out of ${maxScore}`}
                ></div>
            </div>
            {scoreLabel && (
                <span className="text-xs font-medium text-muted-foreground w-20 text-right shrink-0">
                    {scoreLabel}
                </span>
            )}
        </div>
    );
}; 