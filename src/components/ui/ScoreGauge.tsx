import React, { useEffect, useMemo, useState } from 'react';
import { describeArc } from '../../sidepanel/helpers/scoreGaugeHelpers';

const GAUGE_BACKGROUND_COLORS = {
    NULL: 'hsl(215.4 16.3% 56.9%)', // gray-500
    BACKGROUND: 'hsl(215 20.2% 92%)', // Approx hsl(var(--muted))
};

const GAUGE_HSL_STOPS = {
    POOR: { h: 0, s: 84.2, l: 60.2 },
    AVERAGE: { h: 47.9, s: 95.8, l: 53.1 },
    EXCELLENT: { h: 142.1, s: 70.6, l: 45.3 },
};

/**
 * Interpolates between two HSL color values based on a factor (0-1).
 */
const interpolateHsl = (
    start: { h: number; s: number; l: number },
    end: { h: number; s: number; l: number },
    factor: number
): { h: number; s: number; l: number } => {
    // Handle hue interpolation carefully (shortest path around the color wheel)
    let h1 = start.h;
    let h2 = end.h;
    const diff = h2 - h1;
    if (Math.abs(diff) > 180) {
        // Adjust end hue if the difference is more than half the circle
        if (diff > 0) {
            h1 += 360;
        } else {
            h2 += 360;
        }
    }
    const h = (h1 + (h2 - h1) * factor) % 360;
    const s = start.s + (end.s - start.s) * factor;
    const l = start.l + (end.l - start.l) * factor;
    return { h, s, l };
};

/**
 * Gets the gauge color based on score, using HSL interpolation for a gradient effect.
 */
const getScoreColor = (score: number | null): string => {
    if (score === null || isNaN(score)) {
        return GAUGE_BACKGROUND_COLORS.NULL;
    }

    const normalizedScore = Math.max(0, Math.min(100, score)) / 100; // Clamp score to 0-100 and normalize

    let colorHsl: { h: number; s: number; l: number };

    if (normalizedScore < 0.5) {
        // Interpolate between POOR (0.0) and AVERAGE (0.5)
        const factor = normalizedScore * 2; // Scale factor from 0-1 for this segment
        colorHsl = interpolateHsl(GAUGE_HSL_STOPS.POOR, GAUGE_HSL_STOPS.AVERAGE, factor);
    } else {
        // Interpolate between AVERAGE (0.5) and EXCELLENT (1.0)
        const factor = (normalizedScore - 0.5) * 2; // Scale factor from 0-1 for this segment
        colorHsl = interpolateHsl(GAUGE_HSL_STOPS.AVERAGE, GAUGE_HSL_STOPS.EXCELLENT, factor);
    }

    return `hsl(${colorHsl.h.toFixed(1)} ${colorHsl.s.toFixed(1)}% ${colorHsl.l.toFixed(1)}%)`;
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
                stroke={GAUGE_BACKGROUND_COLORS.BACKGROUND}
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