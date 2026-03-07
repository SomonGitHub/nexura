/**
 * WeatherOverlay — Ambient weather visual effects layer.
 *
 * Renders pure CSS-animated weather effects (sun, clouds, rain, snow)
 * above the background but below the tile grid. All elements use
 * pointer-events: none and are memoized with React.memo to avoid
 * re-renders during drag operations.
 *
 * The particles (rain drops, snowflakes) are generated once at mount
 * time with randomized positions/delays for a natural appearance.
 */
import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './WeatherOverlay.css';

/** Weather effect configuration mode */
export type WeatherEffectsMode = 'off' | 'sun_only' | 'all';

interface WeatherOverlayProps {
    /** Current weather entity state (e.g. "sunny", "rainy", "cloudy") */
    weatherState: string;
    /** Configuration mode: off, sun_only, or all effects */
    mode: WeatherEffectsMode;
}

/**
 * Determine which visual effects to show based on weather state and mode.
 */
const getActiveEffects = (
    state: string,
    mode: WeatherEffectsMode
): { sun: boolean; sunReduced: boolean; clouds: boolean; cloudsDense: boolean; rain: boolean; snow: boolean } => {
    const effects = {
        sun: false,
        sunReduced: false,
        clouds: false,
        cloudsDense: false,
        rain: false,
        snow: false,
    };

    if (mode === 'off') return effects;

    const normalized = state.toLowerCase().replace(/-/g, '');

    // Sun effects (always available if mode != off)
    if (['sunny', 'clearnight'].includes(normalized)) {
        effects.sun = true;
    } else if (['partlycloudy'].includes(normalized)) {
        effects.sun = true;
        effects.sunReduced = true;
    }

    // Cloud / precipitation effects (only if mode = all)
    if (mode === 'all') {
        if (['partlycloudy'].includes(normalized)) {
            effects.clouds = true;
        }
        if (['cloudy'].includes(normalized)) {
            effects.clouds = true;
        }
        if (['rainy'].includes(normalized)) {
            effects.clouds = true;
            effects.rain = true;
        }
        if (['pouring'].includes(normalized)) {
            effects.cloudsDense = true;
            effects.rain = true;
        }
        if (['snowy', 'snowyrainy'].includes(normalized)) {
            effects.clouds = true;
            effects.snow = true;
        }
    }

    return effects;
};

/**
 * Generate randomized positions and animation delays for rain particles.
 * Created once and memoized to avoid re-generating during re-renders.
 */
const generateRaindrops = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        id: `rain-${i}`,
        left: `${Math.random() * 100}%`,
        animationDuration: `${1 + Math.random() * 1}s`,
        animationDelay: `${Math.random() * 2}s`,
        opacity: 0.06 + Math.random() * 0.08,
    }));

/**
 * Generate randomized positions and animation delays for snow particles.
 */
const generateSnowflakes = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        id: `snow-${i}`,
        left: `${Math.random() * 100}%`,
        size: `${3 + Math.random() * 3}px`,
        animationDuration: `${4 + Math.random() * 3}s`,
        animationDelay: `${Math.random() * 4}s`,
        opacity: 0.08 + Math.random() * 0.1,
    }));

/**
 * WeatherOverlay component — renders ambient visual effects.
 * Memoized to prevent unnecessary re-renders during tile interactions.
 */
const WeatherOverlayInner: React.FC<WeatherOverlayProps> = ({
    weatherState,
    mode,
}) => {
    const effects = getActiveEffects(weatherState, mode);

    // Generate particles once with stable references
    const raindrops = useMemo(() => generateRaindrops(30), []);
    const snowflakes = useMemo(() => generateSnowflakes(20), []);

    // Don't render anything if no effects are active
    const hasAnyEffect = Object.values(effects).some(Boolean);
    if (!hasAnyEffect) return null;

    return (
        <div className="weather-overlay">
            <AnimatePresence>
                {/* Sun glow */}
                {effects.sun && (
                    <motion.div
                        key="sun-glow"
                        className={`sun-glow ${effects.sunReduced ? 'sun-reduced' : ''}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2 }}
                    />
                )}

                {/* Sun rays */}
                {effects.sun && (
                    <motion.div
                        key="sun-rays"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2.5 }}
                    >
                        <div className="sun-ray" />
                        <div className="sun-ray" />
                        <div className="sun-ray" />
                    </motion.div>
                )}

                {/* Clouds */}
                {(effects.clouds || effects.cloudsDense) && (
                    <motion.div
                        key="clouds"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 3 }}
                    >
                        <div className={`cloud cloud-1 ${effects.cloudsDense ? 'cloud-dense' : ''}`} />
                        <div className={`cloud cloud-2 ${effects.cloudsDense ? 'cloud-dense' : ''}`} />
                        <div className={`cloud cloud-3 ${effects.cloudsDense ? 'cloud-dense' : ''}`} />
                    </motion.div>
                )}

                {/* Rain */}
                {effects.rain && (
                    <motion.div
                        key="rain"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5 }}
                    >
                        {raindrops.map(drop => (
                            <div
                                key={drop.id}
                                className="raindrop"
                                style={{
                                    left: drop.left,
                                    animationDuration: drop.animationDuration,
                                    animationDelay: drop.animationDelay,
                                    opacity: drop.opacity,
                                }}
                            />
                        ))}
                    </motion.div>
                )}

                {/* Snow */}
                {effects.snow && (
                    <motion.div
                        key="snow"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2 }}
                    >
                        {snowflakes.map(flake => (
                            <div
                                key={flake.id}
                                className="snowflake"
                                style={{
                                    left: flake.left,
                                    width: flake.size,
                                    height: flake.size,
                                    animationDuration: flake.animationDuration,
                                    animationDelay: flake.animationDelay,
                                    opacity: flake.opacity,
                                }}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const WeatherOverlay = React.memo(WeatherOverlayInner);
