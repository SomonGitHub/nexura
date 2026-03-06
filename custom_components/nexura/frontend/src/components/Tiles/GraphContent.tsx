import React from 'react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import './Tiles.css';

interface DataPoint {
    time: string;
    value: number;
}

interface GraphContentProps {
    data: DataPoint[];
    color?: string;
    label?: string;
    currentValue?: string;
    isEditMode?: boolean;
}

export const GraphContent: React.FC<GraphContentProps> = ({
    data,
    color = "var(--primary, #007bff)",
    label,
    currentValue,
    isEditMode = false
}) => {
    // Prevent event propagation so DND-kit doesn't interfere when hovering/swiping the chart
    const stopPropagation = React.useCallback((e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
    }, []);

    return (
        <div
            className={`tile-content-container tile-graph ${isEditMode ? 'readonly' : ''}`}
            onPointerDown={!isEditMode ? stopPropagation : undefined}
        >
            <div className="graph-header">
                {label && <span className="tile-label">{label}</span>}
                {currentValue && <span className="graph-current-value">{currentValue}</span>}
            </div>
            <div className="graph-chart-wrapper" style={{ minHeight: '80px', flex: 1 }}>
                {data && data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={3}
                                dot={false}
                                isAnimationActive={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center', padding: '0 10px' }}>
                        <div style={{ marginBottom: '4px', opacity: 0.5 }}>📊</div>
                        {currentValue ? "Collecte des données (v2)..." : "Aucune donnée"}
                    </div>
                )}
            </div>
        </div>
    );
};
