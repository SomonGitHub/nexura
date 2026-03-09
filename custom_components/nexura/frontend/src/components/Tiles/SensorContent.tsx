import React, { useEffect, useRef, useState } from 'react';
import './SensorContent.css';

interface SensorContentProps {
    value: string | number;
    unit?: string;
    label?: string;
    variant?: 'none' | 'danger' | 'info';
}

export const SensorContent: React.FC<SensorContentProps> = ({ value, unit, label, variant = 'none' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [fontSize, setFontSize] = useState<number>(32); // Initial base size

    useEffect(() => {
        if (!containerRef.current || !textRef.current) return;

        const container = containerRef.current;
        const textElement = textRef.current;

        const updateFontSize = () => {
            const containerWidth = container.clientWidth;
            if (containerWidth <= 0) return;

            // Reset font size to a known value to measure accurately
            // Alternatively, use the current width and current font size to find the ratio
            const currentWidth = textElement.scrollWidth;
            const currentFontSize = parseFloat(window.getComputedStyle(textElement).fontSize);

            if (currentWidth > 0) {
                // target 92% of container width to give a safety margin and avoid overflows
                const targetWidth = containerWidth * 0.92;
                let newSize = (targetWidth / currentWidth) * currentFontSize;

                // Constraints
                const maxSize = 120;
                const minSize = 12;
                newSize = Math.min(Math.max(newSize, minSize), maxSize);

                setFontSize(newSize);
            }
        };

        const observer = new ResizeObserver(updateFontSize);
        observer.observe(container);

        // Initial call
        updateFontSize();

        return () => observer.disconnect();
    }, [value, unit]);

    return (
        <div className={`sensor-content variant-${variant}`}>
            <div className="sensor-value-container" ref={containerRef}>
                <div
                    className="sensor-value-wrapper"
                    ref={textRef}
                    style={{ fontSize: `${fontSize}px` }}
                >
                    <span className="sensor-value">{value}</span>
                    {unit && <span className="sensor-unit">{unit}</span>}
                </div>
            </div>
            {label && <div className="sensor-label">{label}</div>}
        </div>
    );
};
