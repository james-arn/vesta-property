import React, { useEffect, useMemo, useState } from 'react';
import { describeArc } from '../../sidepanel/helpers/scoreGaugeHelpers';

// Define colors for segments
const GAUGE_COLORS = {
    POOR: 'hsl(0 84.2% 60.2%)',      // red-500
    BELOW_AVERAGE: 'hsl(24.6 95% 53.1%)', // orange-500
    AVERAGE: 'hsl(47.9 95.8% 53.1%)',    // yellow-500
    GOOD: 'hsl(84.2 70.2% 46.1%)',     // lime-500
    EXCELLENT: 'hsl(142.1 70.6% 45.3%)', // green-500
    NULL: 'hsl(215.4 16.3% 56.9%)', // gray-500
    BACKGROUND: 'hsl(215 20.2% 92%)', // Approx hsl(var(--muted))
};

// Determine color based on score
const getScoreColor = (score: number | null): string => {
    if (score === null || isNaN(score)) return GAUGE_COLORS.NULL;
    if (score < 20) return GAUGE_COLORS.POOR;
    if (score < 40) return GAUGE_COLORS.BELOW_AVERAGE;
    if (score < 60) return GAUGE_COLORS.AVERAGE;
    if (score < 80) return GAUGE_COLORS.GOOD;
    return GAUGE_COLORS.EXCELLENT;
};

interface ScoreGaugeProps {
    score: number | null; // Score 0-100
    size?: number; // Approx width/height control
    label?: string; // Optional label text below score
    strokeWidth?: number; // Thickness of the gauge bar
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
    score,
    size = 200,
    label,
    strokeWidth = 12
}) => {
    const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);

    const semiCircleCircumference = useMemo(() => radius * Math.PI, [radius]);

    const scoreAngleSpan = useMemo(() =>
        score === null ? 0 : Math.max(0, Math.min(180, (score / 100) * 180)),
        [score]
    );
    const scoreArcLength = useMemo(() =>
        (scoreAngleSpan / 180) * semiCircleCircumference,
        [scoreAngleSpan, semiCircleCircumference]
    );
    const scoreStartAngle = 270;
    const scoreEndAngle = scoreStartAngle + scoreAngleSpan;

    const [currentOffset, setCurrentOffset] = useState(semiCircleCircumference);

    useEffect(function animateGaugeOffset() {
        // Animate the gauge by updating the offset when score changes. Set the target offset based on the score
        setCurrentOffset(semiCircleCircumference - scoreArcLength);
    }, [scoreArcLength, semiCircleCircumference]);

    const viewBoxSize = size;
    const center = viewBoxSize / 2;

    // describeArc uses 0 degrees = 12 o'clock.
    // Top semi-circle goes from 270 (left) to 90 (right).
    const backgroundStartAngle = 270;
    const backgroundEndAngle = 90;

    // Generate path descriptions (these could be memoized too, but less critical for animation)
    const backgroundPathD = describeArc(center, center, radius, backgroundStartAngle, backgroundEndAngle);
    const scorePathD = describeArc(center, center, radius, scoreStartAngle, scoreEndAngle);

    const scoreColor = getScoreColor(score);

    // Text positioning constants (adjust as needed)
    // Adjust offsets to move text block higher into the arc
    const scoreYOffset = -25; // Move text block significantly higher
    const labelYOffset = -5;  // Position label below score, but still high

    // Calculate height needed to tightly fit content
    // Lowest point is label baseline (center + labelYOffset) + some padding
    const contentHeight = center + labelYOffset + 10; // Add 10px padding below label

    const scorePathStyle = useMemo(() => ({
        strokeDasharray: semiCircleCircumference,
        strokeDashoffset: currentOffset,
        transition: 'stroke-dashoffset 0.5s ease-out'
    }), [semiCircleCircumference, currentOffset]);

    return (
        <svg
            width={size}
            height={contentHeight}
            viewBox={`0 0 ${viewBoxSize} ${contentHeight}`}
            className="block mx-auto"
        >
            {/* Background Track */}
            <path
                d={backgroundPathD}
                fill="none"
                stroke={GAUGE_COLORS.BACKGROUND}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Score Arc - only render if score is not null */}
            {score !== null && scorePathD && (
                <path
                    d={scorePathD}
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={scorePathStyle} // Apply memoized style using state offset
                />
            )}

            {/* Score Text */}
            <text
                x={center}
                y={center + scoreYOffset}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`fill-foreground ${size > 150 ? 'text-3xl' : 'text-2xl'} font-bold`}
            >
                {score === null ? '--' : score.toFixed(0)}
            </text>

            {/* Optional Label Text */}
            {label && (
                <text
                    x={center}
                    y={center + labelYOffset}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-sm"
                >
                    {label}
                </text>
            )}
        </svg>
    );
}; 