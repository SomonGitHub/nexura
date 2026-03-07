/**
 * useTimeGradient — Dynamic day/night background gradient hook.
 *
 * Computes a radial-gradient CSS value based on the current time of day,
 * interpolating between 8 predefined color stops in HSL space for smooth
 * transitions. Recalculates every 5 minutes and applies the gradient
 * directly to `document.body` via CSS custom properties.
 *
 * @param enabled - Whether the day/night cycle is active
 */
import { useEffect, useRef } from 'react';

// --- Color stop definitions (start + end colors for each time segment) ---

interface ColorStop {
    /** Hour at which this stop begins */
    hour: number;
    /** Radial gradient start color (center) */
    start: [number, number, number]; // [H, S, L]
    /** Radial gradient end color (edge) */
    end: [number, number, number];   // [H, S, L]
}

/**
 * 8 time-of-day color stops defining the ambient gradient palette.
 * Colors are in HSL format [hue, saturation%, lightness%].
 */
const COLOR_STOPS: ColorStop[] = [
    // 01h-05h — Deep night (near-black blue)
    { hour: 1, start: [230, 40, 5], end: [225, 35, 6] },
    // 05h-07h — Dawn (deep purple → warm orange)
    { hour: 5, start: [270, 60, 12], end: [18, 90, 55] },
    // 07h-10h — Morning (deep blue → sky blue)
    { hour: 7, start: [210, 55, 25], end: [197, 60, 72] },
    // 10h-14h — Midday (strong blue → bright blue)
    { hour: 10, start: [207, 80, 30], end: [199, 65, 62] },
    // 14h-17h — Afternoon (blue → warm gold)
    { hour: 14, start: [205, 55, 28], end: [28, 75, 70] },
    // 17h-19h — Twilight (indigo → orange red)
    { hour: 17, start: [232, 75, 20], end: [8, 75, 55] },
    // 19h-21h — Evening (very dark blue)
    { hour: 19, start: [215, 50, 10], end: [210, 35, 12] },
    // 21h-01h — Night (near-black blue)
    { hour: 21, start: [225, 45, 6], end: [220, 40, 7] },
];

/**
 * Linearly interpolate between two HSL values.
 * Handles hue wrapping for smooth transitions across 360°.
 */
const interpolateHSL = (
    a: [number, number, number],
    b: [number, number, number],
    t: number
): [number, number, number] => {
    // Handle hue interpolation across the 360° boundary
    let hDiff = b[0] - a[0];
    if (hDiff > 180) hDiff -= 360;
    if (hDiff < -180) hDiff += 360;

    const h = ((a[0] + hDiff * t) % 360 + 360) % 360;
    const s = a[1] + (b[1] - a[1]) * t;
    const l = a[2] + (b[2] - a[2]) * t;

    return [h, s, l];
};

/**
 * Convert HSL tuple to CSS hsl() string.
 */
const hslToString = (hsl: [number, number, number]): string =>
    `hsl(${Math.round(hsl[0])}, ${Math.round(hsl[1])}%, ${Math.round(hsl[2])}%)`;

/**
 * Find the current and next color stops, and compute the interpolation
 * factor based on the current time.
 */
const computeGradient = (): string => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    // Find which segment we're in
    let currentIdx = 0;
    for (let i = COLOR_STOPS.length - 1; i >= 0; i--) {
        if (currentHour >= COLOR_STOPS[i].hour) {
            currentIdx = i;
            break;
        }
    }

    const currentStop = COLOR_STOPS[currentIdx];
    const nextStop = COLOR_STOPS[(currentIdx + 1) % COLOR_STOPS.length];

    // Calculate how far through this segment we are (0..1)
    let nextHour = nextStop.hour;
    if (nextHour <= currentStop.hour) nextHour += 24; // Handle midnight wrap

    let adjustedCurrent = currentHour;
    if (adjustedCurrent < currentStop.hour) adjustedCurrent += 24;

    const segmentDuration = nextHour - currentStop.hour;
    const elapsed = adjustedCurrent - currentStop.hour;
    const t = Math.max(0, Math.min(1, elapsed / segmentDuration));

    // Interpolate both start and end colors
    const startColor = interpolateHSL(currentStop.start, nextStop.start, t);
    const endColor = interpolateHSL(currentStop.end, nextStop.end, t);

    return `radial-gradient(circle at top right, ${hslToString(startColor)}, ${hslToString(endColor)})`;
};

/**
 * Hook that applies a dynamic day/night gradient to the page background.
 * Updates every 5 minutes for smooth, imperceptible transitions.
 */
export const useTimeGradient = (enabled: boolean): void => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!enabled) {
            // Restore default gradient when disabled
            document.body.style.removeProperty('background');
            return;
        }

        // Apply immediately on mount / enable
        const apply = () => {
            document.body.style.setProperty('background', computeGradient());
            document.body.style.setProperty('background-attachment', 'fixed');
        };

        apply();

        // Recalculate every 5 minutes
        intervalRef.current = setInterval(apply, 5 * 60 * 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            // Restore default on cleanup
            document.body.style.removeProperty('background');
            document.body.style.removeProperty('background-attachment');
        };
    }, [enabled]);
};
