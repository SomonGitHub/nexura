/**
 * EnergyFlowContent — Animated energy flow visualization.
 *
 * Renders an SVG with nodes (Solar, Home, Grid, Battery) connected
 * by Bézier curves. Animated particles (SVG circles) travel along
 * the curves via <animateMotion> to visually represent power flow.
 *
 * Nodes without linked entities are automatically hidden and the
 * layout adapts accordingly.
 */
import React, { useMemo } from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import './EnergyFlowContent.css';

interface EnergyFlowContentProps {
    /** All HA entities for reading state */
    hassEntities: HassEntities;
    /** Entity ID for solar production */
    solarEntityId?: string;
    /** Entity ID for grid power (positive = import, negative = export) */
    gridEntityId?: string;
    /** Entity ID for battery power */
    batteryEntityId?: string;
    /** Entity ID for battery SOC level (%) */
    batteryLevelEntityId?: string;
    /** Entity ID for home consumption (optional, can be calculated) */
    homeEntityId?: string;
}

/** A node in the energy flow diagram */
interface FlowNode {
    id: string;
    label: string;
    emoji: string;
    x: number;
    y: number;
    value: number;
    unit: string;
    active: boolean;
    color: string;
    glowClass: string;
}

/** A connection between two nodes */
interface FlowConnection {
    from: FlowNode;
    to: FlowNode;
    power: number;
    color: string;
    path: string;
    reversed: boolean;
}

/**
 * Format watts to a readable string with auto kW conversion.
 */
const formatWatts = (watts: number): string => {
    const abs = Math.abs(watts);
    if (abs >= 1000) return `${(abs / 1000).toFixed(1)} kW`;
    return `${Math.round(abs)} W`;
};

/**
 * Generate a cubic Bézier path between two points.
 */
const bezierPath = (
    x1: number, y1: number,
    x2: number, y2: number
): string => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    // Control points offset for smooth curves
    const cx1 = x1 + dx * 0.4;
    const cy1 = y1 + dy * 0.1;
    const cx2 = x2 - dx * 0.4;
    const cy2 = y2 - dy * 0.1;
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
};

/**
 * Read a numeric entity state, returning 0 if unavailable.
 */
const readEntityValue = (entities: HassEntities, entityId?: string): number => {
    if (!entityId) return 0;
    const entity = entities[entityId];
    if (!entity) return 0;
    const val = parseFloat(entity.state);
    return isNaN(val) ? 0 : val;
};

/**
 * Compute particle animation duration based on power level.
 * Higher power = faster particles (shorter duration).
 */
const particleDuration = (power: number): number => {
    const abs = Math.abs(power);
    if (abs <= 0) return 0;
    if (abs < 500) return 4;
    if (abs < 2000) return 3;
    if (abs < 5000) return 2;
    return 1.5;
};

/**
 * Generate multiple particle elements for a connection.
 */
const renderParticles = (
    connection: FlowConnection,
    index: number
): React.ReactNode[] => {
    if (connection.power <= 0) return [];

    const count = Math.min(5, Math.max(2, Math.ceil(connection.power / 1000)));
    const dur = particleDuration(connection.power);
    const particles: React.ReactNode[] = [];

    for (let i = 0; i < count; i++) {
        const delay = (dur / count) * i;
        const pathId = `flow-path-${index}`;

        particles.push(
            <circle
                key={`particle-${index}-${i}`}
                className="flow-particle"
                r={3}
                fill={connection.color}
                opacity={0.8}
            >
                <animateMotion
                    dur={`${dur}s`}
                    repeatCount="indefinite"
                    begin={`${delay}s`}
                    keyPoints={connection.reversed ? '1;0' : '0;1'}
                    keyTimes="0;1"
                    calcMode="linear"
                >
                    <mpath href={`#${pathId}`} />
                </animateMotion>
            </circle>
        );
    }

    return particles;
};

export const EnergyFlowContent: React.FC<EnergyFlowContentProps> = ({
    hassEntities,
    solarEntityId,
    gridEntityId,
    batteryEntityId,
    batteryLevelEntityId,
    homeEntityId,
}) => {
    // Read entity values
    const solarPower = readEntityValue(hassEntities, solarEntityId);
    const gridPower = readEntityValue(hassEntities, gridEntityId);
    const batteryPower = readEntityValue(hassEntities, batteryEntityId);
    const batteryLevel = readEntityValue(hassEntities, batteryLevelEntityId);
    const homePower = homeEntityId
        ? readEntityValue(hassEntities, homeEntityId)
        : Math.max(0, solarPower + gridPower - Math.max(0, batteryPower));

    const hasSolar = !!solarEntityId;
    const hasBattery = !!batteryEntityId;
    const hasGrid = !!gridEntityId;

    // Build nodes with adaptive positioning
    const nodes = useMemo((): FlowNode[] => {
        const result: FlowNode[] = [];

        // Home is always centered
        result.push({
            id: 'home', label: 'Maison', emoji: '🏠',
            x: 150, y: 100, value: homePower, unit: 'W',
            active: true, color: '#ffffff', glowClass: 'node-glow-home',
        });

        if (hasSolar) {
            result.push({
                id: 'solar', label: 'Solaire', emoji: '☀️',
                x: 150, y: 20, value: solarPower, unit: 'W',
                active: solarPower > 0, color: '#ffc832', glowClass: 'node-glow-solar',
            });
        }

        if (hasGrid) {
            result.push({
                id: 'grid', label: 'Réseau', emoji: '⚡',
                x: 270, y: 100, value: Math.abs(gridPower), unit: 'W',
                active: true, color: '#6496ff', glowClass: 'node-glow-grid',
            });
        }

        if (hasBattery) {
            result.push({
                id: 'battery', label: 'Batterie', emoji: '🔋',
                x: 30, y: 180, value: batteryLevel, unit: '%',
                active: true, color: '#00ff88', glowClass: 'node-glow-battery',
            });
        }

        return result;
    }, [hasSolar, hasGrid, hasBattery, solarPower, gridPower, batteryLevel, homePower]);

    // Build connections
    const connections = useMemo((): FlowConnection[] => {
        const home = nodes.find(n => n.id === 'home')!;
        const result: FlowConnection[] = [];

        // Solar → Home
        if (hasSolar && solarPower > 0) {
            const solar = nodes.find(n => n.id === 'solar')!;
            result.push({
                from: solar, to: home,
                power: solarPower,
                color: '#ffc832',
                path: bezierPath(solar.x, solar.y + 20, home.x, home.y - 20),
                reversed: false,
            });
        }

        // Grid ↔ Home
        if (hasGrid) {
            const grid = nodes.find(n => n.id === 'grid')!;
            if (gridPower > 0) {
                // Importing from grid
                result.push({
                    from: grid, to: home,
                    power: gridPower,
                    color: '#6496ff',
                    path: bezierPath(home.x + 20, home.y, grid.x - 20, grid.y),
                    reversed: true,
                });
            } else if (gridPower < 0) {
                // Exporting to grid
                result.push({
                    from: home, to: grid,
                    power: Math.abs(gridPower),
                    color: '#00ff88',
                    path: bezierPath(home.x + 20, home.y, grid.x - 20, grid.y),
                    reversed: false,
                });
            }
        }

        // Battery ↔ Home
        if (hasBattery && batteryPower !== 0) {
            const battery = nodes.find(n => n.id === 'battery')!;
            if (batteryPower > 0) {
                // Charging battery
                result.push({
                    from: home, to: battery,
                    power: batteryPower,
                    color: '#00ff88',
                    path: bezierPath(home.x - 20, home.y + 20, battery.x + 20, battery.y - 20),
                    reversed: false,
                });
            } else {
                // Discharging battery
                result.push({
                    from: battery, to: home,
                    power: Math.abs(batteryPower),
                    color: '#00ff88',
                    path: bezierPath(home.x - 20, home.y + 20, battery.x + 20, battery.y - 20),
                    reversed: true,
                });
            }
        }

        return result;
    }, [nodes, hasSolar, hasGrid, hasBattery, solarPower, gridPower, batteryPower]);

    return (
        <div className="energy-flow">
            <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
                {/* Connection paths (drawn first, behind nodes) */}
                {connections.map((conn, i) => (
                    <path
                        key={`path-${i}`}
                        id={`flow-path-${i}`}
                        className="flow-path"
                        d={conn.path}
                    />
                ))}

                {/* Animated particles */}
                {connections.map((conn, i) =>
                    renderParticles(conn, i)
                )}

                {/* Nodes */}
                {nodes.map(node => (
                    <g key={node.id} className="energy-node">
                        {/* Glow background */}
                        <circle
                            className={`node-bg ${node.active ? node.glowClass : ''}`}
                            cx={node.x}
                            cy={node.y}
                            r={22}
                        />
                        {/* Icon */}
                        <text
                            className="node-icon"
                            x={node.x}
                            y={node.y + 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="18"
                        >
                            {node.emoji}
                        </text>
                        {/* Value */}
                        <text
                            className="node-value"
                            x={node.x}
                            y={node.y + 35}
                            textAnchor="middle"
                        >
                            {node.unit === '%'
                                ? `${Math.round(node.value)}%`
                                : formatWatts(node.value)
                            }
                        </text>
                        {/* Label */}
                        <text
                            className="node-label"
                            x={node.x}
                            y={node.y + 46}
                            textAnchor="middle"
                        >
                            {node.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};
