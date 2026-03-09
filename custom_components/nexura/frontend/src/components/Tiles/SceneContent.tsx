import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './SceneContent.css';

interface SceneContentProps {
    onTrigger: () => void;
    isEditMode?: boolean;
}

export const SceneContent: React.FC<SceneContentProps> = ({ onTrigger, isEditMode = false }) => {
    const [isTriggered, setIsTriggered] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isEditMode || isTriggered) return;

        setIsTriggered(true);
        onTrigger();

        // Reset triggered state after animation
        setTimeout(() => {
            setIsTriggered(false);
        }, 1500);
    };

    return (
        <div className={`scene-tile-content ${isEditMode ? 'edit-mode' : ''}`}>
            <motion.div
                className="scene-button-container"
                whileHover={!isEditMode ? { scale: 1.05 } : {}}
                whileTap={!isEditMode ? { scale: 0.92 } : {}}
                onClick={handleClick}
            >
                {/* Breathing Halo Glow */}
                <div className={`scene-halo-glow ${isTriggered ? 'triggered' : 'breathing'}`} />

                {/* Main Physical Button */}
                <div className="scene-button-glass">
                    <span className="scene-action-text">Activer</span>
                </div>

                {/* Celebration Ripple */}
                <AnimatePresence>
                    {isTriggered && (
                        <motion.div
                            className="scene-ripple"
                            initial={{ scale: 0, opacity: 0.8 }}
                            animate={{ scale: 2.5, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
