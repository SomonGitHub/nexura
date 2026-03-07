/**
 * EnergyGaugeContent — Circular SVG arc gauge for energy consumption.
 *
 * Renders a 270° arc that fills proportionally to the current power
 * value vs a configurable maximum. The arc color transitions from
 * green (low) through orange (mid) to red (high).
 *
 * @param value — Current power in watts
 * @param maxValue — Maximum expected power in watts (default 9000)
 * @param unit — Display unit (default "W")
 * @param label — Label below the value (default "Consommation")
 */
import React from 'react';
import './EnergyGaugeContent.css';

interface EnergyGaugeContentProps {
    /** Current power value in watts */
    value: number;
    /** Maximum power for the gauge scale (default 9000W) */
    maxValue?: number;
    /** Display unit (default "W") */
    unit?: string;
    /** Label below the value */
    label?: string;
}

/**
 * Format a watt value for display, converting to kW for large values.
 */
const formatPower = (watts: number, unit: string): { value: string; unit: string } => {
    if (unit === 'W' && Math.abs(watts) >= 1000) {
        return { value: (watts / 1000).toFixed(1), unit: 'kW' };
    }
    return { value: Math.round(watts).toString(), unit };
};

/**
 * Compute arc color based on percentage fill (green → orange → red).
 */
const getArcColor = (percent: number): string => {
    if (percent <= 0.3) {
        // Green to orange
        const t = percent / 0.3;
        const r = Math.round(0 + t * 240);
        const g = Math.round(255 - t * 77);
        const b = Math.round(136 - t * 93);
        return `rgb(${r}, ${g}, ${b})`;
    } else if (percent <= 0.7) {
        // Orange to red
        const t = (percent - 0.3) / 0.4;
        const r = Math.round(240 + t * 15);
        const g = Math.round(178 - t * 108);
        const b = Math.round(43 - t * 15);
        return `rgb(${r}, ${g}, ${b})`;
    }
    // Red
    return '#e74c3c';
};

/**
 * SVG arc gauge component.
 */
export const EnergyGaugeContent: React.FC<EnergyGaugeContentProps> = ({
    value,
    maxValue = 9000,
    unit = 'W',
    label = 'Consommation',
}) => {
    // Arc geometry constants
    const cx = 80;
    const cy = 80;
    const radius = 65;
    const strokeWidth = 10;
    // 270° arc (3/4 circle, opening at bottom)
    const arcAngle = 270;
    const circumference = 2 * Math.PI * radius;
    const arcLength = (arcAngle / 360) * circumference;

    // Calculate fill percentage
    const percent = Math.max(0, Math.min(1, value / maxValue));
    const fillLength = arcLength * percent;
    const dashOffset = arcLength - fillLength;

    // SVG arc path (start at bottom-left, sweep clockwise 270°)
    const startAngle = 135; // degrees, bottom-left
    const endAngle = 135 + arcAngle; // bottom-right
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = arcAngle > 180 ? 1 : 0;
    const arcPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    const formatted = formatPower(value, unit);
    const arcColor = getArcColor(percent);

    return (
        <div className="energy-gauge">
            <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
                {/* Background arc */}
                <path
                    className="gauge-arc-bg"
                    d={arcPath}
                    strokeWidth={strokeWidth}
                />
                {/* Filled arc */}
                <path
                    className="gauge-arc-fill"
                    d={arcPath}
                    strokeWidth={strokeWidth}
                    stroke={arcColor}
                    strokeDasharray={`${arcLength}`}
                    strokeDashoffset={dashOffset}
                />
            </svg>
            <div className="gauge-value-container">
                <span className="gauge-value">{formatted.value}</span>
                <span className="gauge-unit">{formatted.unit}</span>
            </div>
            {label && <span className="gauge-label">{label}</span>}
        </div>
    );
};
