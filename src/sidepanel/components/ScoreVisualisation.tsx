import { calculateHueFromPercentage } from '@/lib/colorHelpers'; // Import the helper
import { DashboardScore } from '@/types/property'; // Import the score type
import React from 'react';

interface ScoreVisualisationProps {
    score: DashboardScore;
    invertColorScale?: boolean;
    showLabel?: boolean; // Add optional prop to control label visibility
}

export const ScoreVisualisation: React.FC<ScoreVisualisationProps> = ({
    score,
    invertColorScale = false, // Default to false (high score = green)
    showLabel = true // Default showLabel to true
}) => {
    const { scoreValue, maxScore, scoreLabel } = score;

    // Percentage represents fill amount (higher score = fuller bar)
    const percentage = maxScore > 0 ? Math.max(0, Math.min(100, (scoreValue / maxScore) * 100)) : 0;

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
                        backgroundColor: hslColor
                    }}
                    aria-valuenow={scoreValue}
                    aria-valuemin={0}
                    aria-valuemax={maxScore}
                    role="progressbar"
                    aria-label={`${scoreLabel} score: ${scoreValue} out of ${maxScore}`}
                ></div>
            </div>
            {/* Conditionally render the label based on showLabel prop */}
            {scoreLabel && showLabel && (
                <span className="text-xs font-medium text-muted-foreground w-20 text-right shrink-0">
                    {scoreLabel}
                </span>
            )}
        </div>
    );
}; 