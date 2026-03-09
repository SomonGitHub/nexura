import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { Pencil, Maximize2, Star, Trash2, GripHorizontal } from 'lucide-react';
import { DynamicIcon } from '../DynamicIcon/DynamicIcon';
import { AnimatedHalo } from '../AnimatedHalo/AnimatedHalo';
import { getHaloType } from '../../hooks/useTileStatus';
import { AdaptiveTitle } from '../AdaptiveTitle/AdaptiveTitle';
import type { HassEntities } from 'home-assistant-js-websocket';
import './BentoTile.css';

import type { LayoutEntry, TileTheme } from '../../App';

export type TileSize = 'small' | 'square' | 'rect' | 'large-square' | 'large-rect' | 'mini';

interface BentoTileProps {
    id: string;
    layout?: LayoutEntry;
    size?: TileSize;
    children?: React.ReactNode;
    title?: string;
    type?: string;
    onClick?: () => void;
    isOverlay?: boolean;
    isEditMode?: boolean;
    onDelete?: () => void;
    onResize?: () => void;
    onEdit?: () => void;
    onToggleFavorite?: () => void;
    icon?: string;
    color?: string;
    entityId?: string;
    hassEntities?: HassEntities;
    isFavorite?: boolean;
    className?: string;
    forcedHaloType?: import('../../hooks/useTileStatus').HaloType;
    noPadding?: boolean;
    hideHeader?: boolean;
    /** Whether any tile in the grid is currently being dragged */
    isAnyDragging?: boolean;
    /** Visual theme preset for the tile */
    tileTheme?: TileTheme;
    /** Current entity state for dynamic theme variants */
    entityState?: string;
}

/**
 * Custom comparator for React.memo that prevents unnecessary re-renders.
 * Instead of deep-comparing the entire hassEntities object (which changes
 * on every HA state update), we only compare the specific entity state
 * relevant to this tile.
 */
const areTilePropsEqual = (
    prev: BentoTileProps,
    next: BentoTileProps
): boolean => {
    // Compare all simple props first
    if (
        prev.id !== next.id ||
        prev.size !== next.size ||
        prev.title !== next.title ||
        prev.type !== next.type ||
        prev.isOverlay !== next.isOverlay ||
        prev.isEditMode !== next.isEditMode ||
        prev.icon !== next.icon ||
        prev.color !== next.color ||
        prev.entityId !== next.entityId ||
        prev.isFavorite !== next.isFavorite ||
        prev.className !== next.className ||
        prev.forcedHaloType !== next.forcedHaloType ||
        prev.noPadding !== next.noPadding ||
        prev.hideHeader !== next.hideHeader ||
        prev.isAnyDragging !== next.isAnyDragging ||
        prev.tileTheme !== next.tileTheme ||
        prev.entityState !== next.entityState
    ) {
        return false;
    }

    // Compare layout by value (x, y, w, h, hidden)
    if (prev.layout !== next.layout) {
        if (!prev.layout || !next.layout) return false;
        if (
            prev.layout.x !== next.layout.x ||
            prev.layout.y !== next.layout.y ||
            prev.layout.w !== next.layout.w ||
            prev.layout.h !== next.layout.h ||
            prev.layout.hidden !== next.layout.hidden
        ) {
            return false;
        }
    }

    // Compare only the relevant entity state (not the whole hassEntities map)
    if (prev.entityId) {
        const prevEntity = prev.hassEntities?.[prev.entityId];
        const nextEntity = next.hassEntities?.[prev.entityId];
        if (prevEntity !== nextEntity) return false;
    }

    // Compare callback references (stable if we use useCallback in App)
    if (
        prev.onClick !== next.onClick ||
        prev.onDelete !== next.onDelete ||
        prev.onResize !== next.onResize ||
        prev.onEdit !== next.onEdit ||
        prev.onToggleFavorite !== next.onToggleFavorite
    ) {
        return false;
    }

    // Compare children reference
    if (prev.children !== next.children) return false;

    return true;
};

/**
 * BentoTile component representing an individual tile in the grid.
 * Uses framer-motion for smooth interactions and @dnd-kit for sorting.
 * Wrapped in React.memo with a custom comparator to prevent re-renders
 * during drag operations (critical for tablet performance).
 */
const BentoTileInner: React.FC<BentoTileProps> = ({
    id,
    layout,
    size = 'small',
    children,
    title,
    type,
    onClick,
    isOverlay = false,
    isEditMode = false,
    onDelete,
    onResize,
    onEdit,
    onToggleFavorite,
    icon,
    color,
    entityId,
    hassEntities = {},
    isFavorite = false,
    className = '',
    forcedHaloType,
    noPadding = false,
    hideHeader = false,
    isAnyDragging = false,
    tileTheme,
    entityState,
}) => {
    const [isOverlayActive, setIsOverlayActive] = useState(false);

    // Determine halo type based on entity status or forced override
    const haloType = forcedHaloType || getHaloType(entityId, hassEntities);
    const isSpacer = type === 'spacer';
    const isScene = type === 'scene';

    // IMPORTANT: The DragOverlay component should not use useSortable 
    // to avoid duplicate registration of the same ID in dnd-kit's internal state.
    const sortable = useSortable({ id, disabled: isOverlay });
    const {
        attributes,
        listeners,
        setNodeRef,
        isDragging,
    } = sortable;

    const gridStyle = layout ? {
        gridColumn: `${layout.x + 1} / span ${layout.w}`,
        gridRow: `${layout.y + 1} / span ${layout.h}`,
    } : {};

    const style = {
        ...gridStyle,
        zIndex: isDragging ? 5 : 1,
        '--tile-accent-color': color || 'var(--accent-glow)',
        // No global touchAction: none here to allow scrolling the dashboard
        userSelect: 'none',
        WebkitUserSelect: 'none',
    } as any;

    const sizeClass = `tile-${size}`;

    // Disable layout animations during drag to reduce GPU overhead on tablets.
    // Also disable hover/tap scale when any tile is being dragged.
    const enableLayoutAnim = !isDragging && !isOverlay && !isAnyDragging;

    // Build theme CSS class
    const themeClass = tileTheme && tileTheme !== 'glass' ? `theme-${tileTheme}` : '';
    const stateClass = tileTheme ? (entityState === 'on' ? 'state-on' : entityState === 'off' ? 'state-off' : '') : '';

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            {...attributes}
            layout={enableLayoutAnim}
            initial={false}
            animate={{}}
            transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
            }}
            className={`bento-tile ${layout ? '' : sizeClass} ${isSpacer ? 'tile-spacer' : ''} ${isScene ? 'tile-scene' : ''} ${isDragging ? 'dragging' : ''} ${isDragging && !isOverlay ? 'is-dragging-original' : ''} ${isOverlay ? 'overlay' : ''} ${isEditMode ? 'edit-mode' : ''} ${noPadding ? 'no-padding' : ''} ${layout?.hidden ? 'tile-hidden' : ''} ${themeClass} ${stateClass} ${className}`}
            whileHover={!isOverlay && !isDragging && !isAnyDragging && !isEditMode ? { scale: 1.02 } : undefined}
            whileTap={!isOverlay && !isDragging && !isEditMode ? { scale: 0.98 } : undefined}
            onClick={() => {
                if (isEditMode) {
                    setIsOverlayActive(true);
                } else if (onClick) {
                    onClick();
                }
            }}
            onContextMenu={(e) => isEditMode ? e.preventDefault() : undefined}
        >
            {!isSpacer && <AnimatedHalo type={haloType} />}

            {isEditMode && !isOverlay && !isOverlayActive && (
                <div
                    className="drag-handle-premium"
                    {...listeners}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevents opening the overlay when clicking the handle
                    }}
                    style={{ touchAction: 'none' }}
                >
                    <GripHorizontal size={20} />
                </div>
            )}

            <AnimatePresence>
                {isEditMode && isOverlayActive && !isOverlay && !isDragging && (
                    <motion.div
                        className="tile-glass-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => { e.stopPropagation(); setIsOverlayActive(false); }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="glass-actions-grid">
                            <button
                                className={`glass-action-btn ${isFavorite ? 'is-favorite' : ''}`}
                                onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); setIsOverlayActive(false); }}
                                title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                            >
                                <Star size={24} fill={isFavorite ? "currentColor" : "none"} />
                            </button>
                            <button
                                className="glass-action-btn btn-edit"
                                onClick={(e) => { e.stopPropagation(); onEdit?.(); setIsOverlayActive(false); }}
                                title="Modifier"
                            >
                                <Pencil size={24} />
                            </button>
                            {!isScene && (
                                <button
                                    className="glass-action-btn btn-resize"
                                    onClick={(e) => { e.stopPropagation(); onResize?.(); setIsOverlayActive(false); }}
                                    title="Redimensionner"
                                >
                                    <Maximize2 size={24} />
                                </button>
                            )}
                            <button
                                className="glass-action-btn btn-delete"
                                onClick={(e) => { e.stopPropagation(); onDelete?.(); setIsOverlayActive(false); }}
                                title="Supprimer"
                            >
                                <Trash2 size={24} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!isSpacer && !hideHeader && (
                <div className="tile-header">
                    {icon && (
                        <div className="tile-icon-container" style={{ color: color }}>
                            <DynamicIcon name={icon} size={20} />
                        </div>
                    )}
                    {title && (
                        <AdaptiveTitle
                            text={title}
                            className="tile-title"
                            maxFontSize="1.1rem"
                        />
                    )}
                </div>
            )}

            <div className="tile-content" style={{ pointerEvents: isEditMode ? 'none' : 'auto' }}>
                {children}
            </div>
        </motion.div>
    );
};

export const BentoTile = React.memo(BentoTileInner, areTilePropsEqual);
