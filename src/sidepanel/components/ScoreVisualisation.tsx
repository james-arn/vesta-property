import { DashboardScore } from '@/types/property'; // Import the score type
import React from 'react';

interface ScoreVisualisationProps {
    score: DashboardScore;
    invertColorScale?: boolean;
}

export const ScoreVisualisation: React.FC<ScoreVisualisationProps> = ({
    score,
    invertColorScale = false // Default to false (high score = green)
}) => {
    const { scoreValue, maxScore, scoreLabel } = score;

    // Percentage represents fill amount (higher score = fuller bar)
    const percentage = maxScore > 0 ? Math.max(0, Math.min(100, (scoreValue / maxScore) * 100)) : 0;

    // Function to map percentage to hue (0-120: Red -> Yellow -> Green)
    const calculateHueFromPercentage = (p: number): number => {
        const clampedPercentage = Math.max(0, Math.min(100, p));
        if (clampedPercentage <= 50) {
            // Map 0-50% to Hue 0-60 (Red to Yellow)
            return (clampedPercentage / 50) * 60;
        } else {
            // Map 50-100% to Hue 60-120 (Yellow to Green)
            return 60 + ((clampedPercentage - 50) / 50) * 60;
        }
    };

    // Calculate the base hue (Low score = Red, High score = Green)
    const baseHue = calculateHueFromPercentage(percentage);

    // Invert the hue if needed (e.g., for Risk/Cost where high score = bad = Red)
    const finalHue = invertColorScale ? (120 - baseHue) : baseHue;

    // Set saturation and lightness for a vibrant color
    const saturation = 90;
    const lightness = 50;

    const hslColor = `hsl(${finalHue}, ${saturation}%, ${lightness}%)`;

    return (
        <div className="flex items-center space-x-2 w-full" title={`Score: ${scoreValue}/${maxScore}`}>
            <div className="flex-grow h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${percentage}%`,
                        backgroundColor: hslColor // Apply final (potentially inverted) HSL color
                    }}
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