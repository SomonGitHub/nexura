import React from 'react';
import { motion } from 'framer-motion';
import './AnimatedHalo.css';
import type { HaloType } from '../../hooks/useTileStatus';

interface AnimatedHaloProps {
    type: HaloType;
}

/**
 * AnimatedHalo displays a rotating gradient border effect around tiles.
 * Memoized because the halo type rarely changes and re-rendering the
 * motion.div unnecessarily is wasteful during drag operations.
 */
export const AnimatedHalo: React.FC<AnimatedHaloProps> = React.memo(({ type }) => {
    if (type === 'none') return null;

    return (
        <motion.div
            className={`tile-animated-halo halo-${type}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="halo-gradient"></div>
        </motion.div>
    );
});
