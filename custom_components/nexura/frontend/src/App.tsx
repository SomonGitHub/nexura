import { animate, stagger, utils } from 'animejs'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { connectHass, executeService, type HassConnectionState } from './services/hass';
import { BentoGrid } from './components/BentoGrid/BentoGrid'
import { BentoTile, type TileSize } from './components/BentoTile/BentoTile'
import { ToggleContent } from './components/Tiles/ToggleContent'
import { SliderContent } from './components/Tiles/SliderContent'
import { GraphContent } from './components/Tiles/GraphContent'
import { SensorContent } from './components/Tiles/SensorContent'
import { AddTileModal } from './components/AddTileModal/AddTileModal'
import { Sidebar } from './components/Sidebar/Sidebar';
import { DynamicIcon } from './components/DynamicIcon/DynamicIcon';
import { ScreenSaver } from './components/ScreenSaver/ScreenSaver'
import { WeatherContent } from './components/Tiles/WeatherContent'
import { CoverContent } from './components/Tiles/CoverContent'
import { MediaContent } from './components/Tiles/MediaContent'
import { EnergyGaugeContent } from './components/Tiles/EnergyGaugeContent'
import { EnergyFlowContent } from './components/Tiles/EnergyFlowContent'
import { FloatingStatusBar } from './components/FloatingStatusBar/FloatingStatusBar'
import { SceneContent } from './components/Tiles/SceneContent'
import { CameraContent } from './components/Tiles/CameraContent'
import { FireAlertContent } from './components/Tiles/FireAlertContent'
import { MotionAlertContent } from './components/Tiles/MotionAlertContent';

import { WeatherOverlay, type WeatherEffectsMode } from './components/WeatherOverlay/WeatherOverlay'
import { getHaloType } from './hooks/useTileStatus'
import { getAutoIcon, getAutoColor, getRoomIcon } from './utils/entityMapping'
import { useInactivity } from './hooks/useInactivity'
import { useTimeGradient } from './hooks/useTimeGradient'
import './components/BentoTile/BentoTile.css';
import './components/Sidebar/Sidebar.css';
import './App.css'

export type TileType = 'info' | 'toggle' | 'slider' | 'graph' | 'cover' | 'spacer' | 'media' | 'energy-gauge' | 'energy-flow' | 'scene' | 'camera' | 'fire-alert';
export type TileTheme = 'glass' | 'solid' | 'gradient' | 'minimal' | 'neon' | 'frosted' | 'ocean' | 'forest';
export type Breakpoint = 'ultra' | 'desktop' | 'tablet' | 'mobile';
export type VisibilityOperator = '=' | '!=' | '>' | '<';
export type VisibilityRuleType = 'entity' | 'time';

export interface BaseVisibilityRule {
  type: VisibilityRuleType;
}

export interface EntityVisibilityRule extends BaseVisibilityRule {
  type: 'entity';
  entityId: string;
  operator: VisibilityOperator;
  value: string;
}

export interface TimeVisibilityRule extends BaseVisibilityRule {
  type: 'time';
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export type VisibilityRule = EntityVisibilityRule | TimeVisibilityRule;

export interface LayoutEntry {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
}

export type ViewLayouts = Record<Breakpoint, LayoutEntry[]>;
export type DashboardLayouts = Record<string, ViewLayouts>;

export interface TileData {
  id: string;
  type: TileType;
  title: string;
  size?: TileSize; // Keep as optional for backward compatibility / internal state
  room?: string;
  entityId?: string;
  content?: string;
  isOn?: boolean;
  value?: number;
  graphData?: { time: string; value: number }[];
  graphColor?: string;
  icon?: string;
  color?: string;
  isFavorite?: boolean;
  // Energy tile fields
  maxPower?: number;
  solarEntityId?: string;
  gridEntityId?: string;
  batteryEntityId?: string;
  
  // Predictive Tile fields (Conditional Visibility)
  visibilityRule?: {
    entityId: string;
    operator: VisibilityOperator;
    value: string;
  };
  visibilityRules?: VisibilityRule[];
  batteryLevelEntityId?: string;
  // Tile theme preset
  tileTheme?: TileTheme;
}

const colsConfig = { ultra: 16, desktop: 14, tablet: 12, mobile: 6 };

const mockGraphData = [
  { time: '10:00', value: 300 },
  { time: '10:05', value: 350 },
  { time: '10:10', value: 450 },
  { time: '10:15', value: 400 },
  { time: '10:20', value: 500 },
  { time: '10:25', value: 600 },
  { time: '10:30', value: 450 },
];

const INITIAL_TILES: TileData[] = [
  { id: 'salon', size: 'rect', type: 'toggle', title: 'default_tiles.living_room', entityId: 'light.salon', room: 'default_tiles.living_room', icon: 'Lightbulb', color: '#00ff88', isFavorite: true },
  { id: 'meteo', size: 'small', type: 'info', title: 'default_tiles.weather', content: '18°C ☀️', room: 'default_tiles.outdoor', icon: 'Sun', color: '#ffaa00', isFavorite: true },
  { id: 'security', size: 'small', type: 'info', title: 'default_tiles.security', content: 'states.armed', room: 'default_tiles.global', icon: 'ShieldCheck', color: '#ff4444', isFavorite: true },
  { id: 'conso', size: 'square', type: 'graph', title: 'default_tiles.consumption', content: '450W', room: 'default_tiles.global', graphData: mockGraphData, icon: 'Activity', color: '#ff00ff' },
  { id: 'cuisine', size: 'rect', type: 'toggle', title: 'default_tiles.kitchen', entityId: 'light.cuisine', room: 'default_tiles.kitchen', icon: 'Power', color: '#0088ff', isFavorite: true },
  { id: 'cuisine_light', size: 'rect', type: 'slider', title: 'default_tiles.kitchen_light', entityId: 'light.cuisine', room: 'default_tiles.kitchen', icon: 'Settings', color: '#ffffff' },
];

const collidesWith = (a: LayoutEntry, b: LayoutEntry): boolean => {
  if (a.id === b.id) return false;
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
};

const calculateGridOffset = (delta: number, step: number, threshold = 0.7): number => {
  const fraction = delta / step;
  const absFract = Math.abs(fraction);
  const whole = Math.floor(absFract);
  const remainder = absFract - whole;

  if (remainder < threshold) {
    return (fraction >= 0 ? whole : -whole);
  } else {
    return (fraction >= 0 ? whole + 1 : -(whole + 1));
  }
};

const compactLayout = (layout: LayoutEntry[], activeId?: string | null): LayoutEntry[] => {
  const activeTile = activeId ? layout.find(l => l.id === activeId) : null;
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const result: LayoutEntry[] = [];

  // Place the active tile first if it exists to make it the priority
  if (activeTile) {
    result.push(activeTile);
  }

  sorted.forEach(tile => {
    if (tile.id === activeId) return;

    let currentTile = { ...tile };
    // Only increment Y if there is a collision with already placed tiles
    while (result.some(other => collidesWith(currentTile, other))) {
      currentTile.y++;
    }
    result.push(currentTile);
  });

  return result;
};

const getSizeDimensions = (size: TileSize = 'small'): { w: number, h: number } => {
  switch (size) {
    case 'mini': return { w: 2, h: 1 };
    case 'small': return { w: 2, h: 2 };
    case 'rect': return { w: 4, h: 2 };
    case 'square': return { w: 4, h: 4 };
    case 'large-rect': return { w: 8, h: 4 };
    case 'large-square': return { w: 8, h: 8 };
    default: return { w: 2, h: 2 };
  }
};

const migrateLayouts = (tiles: TileData[], activeView: string): ViewLayouts => {
  const breakpoints: Breakpoint[] = ['ultra', 'desktop', 'tablet', 'mobile'];
  const colsConfig = { ultra: 16, desktop: 14, tablet: 10, mobile: 6 };
  const result: ViewLayouts = { ultra: [], desktop: [], tablet: [], mobile: [] };

  breakpoints.forEach(bp => {
    let currentX = 0;
    let currentY = 0;
    const maxCols = colsConfig[bp];
    const rowHeights: number[] = new Array(maxCols).fill(0);

    // Filter tiles relevant to this view
    const viewTiles = tiles.filter(t => {
      if (activeView === 'favorites') return t.isFavorite;
      if (activeView === 'Inconnue') return !t.room || t.room.trim() === '';
      return t.room === activeView;
    });

    viewTiles.forEach((tile: any) => {
      const dimensions = getSizeDimensions(tile.size);

      if (currentX + dimensions.w > maxCols) {
        currentX = 0;
        currentY = Math.max(...rowHeights);
      }

      result[bp].push({
        id: tile.id,
        x: currentX,
        y: currentY,
        w: Math.min(dimensions.w, maxCols),
        h: dimensions.h
      });

      for (let i = 0; i < dimensions.w && (currentX + i) < maxCols; i++) {
        rowHeights[currentX + i] = currentY + dimensions.h;
      }
      currentX += dimensions.w;
    });
  });

  return result;
};
const STORAGE_KEY = 'nexura_dashboard_tiles_v4';
// Bumped for view-specific layouts

/**
 * Drop animation config — defined outside the component since it has no
 * reactive dependencies. Avoids creating a new object on every render.
 */
const DROP_ANIMATION = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

function App() {
  const { t } = useTranslation()

  const [tiles, setTiles] = useState<TileData[]>([]);
  const [layouts, setLayouts] = useState<DashboardLayouts>({});
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [predictedLayout, setPredictedLayout] = useState<LayoutEntry | null>(null);
  const [theme, setTheme] = useState<'auto' | 'dark' | 'light' | 'nature'>('auto');
  const [screensaverEnabled, setScreensaverEnabled] = useState(true);

  const [isEditMode, setIsEditMode] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState('');
  const [backupTiles, setBackupTiles] = useState<TileData[]>([]);
  const [backupLayouts, setBackupLayouts] = useState<DashboardLayouts>({});
  const [backupTitle, setBackupTitle] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isInactive = useInactivity(120000); // 2 minutes induction period for ScreenSaver
  const [activeView, setActiveView] = useState('favorites');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const [tileToEdit, setTileToEdit] = useState<TileData | null>(null);
  const isAnyDragging = activeId !== null;
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridUnitSize, setGridUnitSize] = useState(80);

  // ResizeObserver to track grid width and calculate dynamic unit size (for 1:1 ratio)
  useEffect(() => {
    if (!gridRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width <= 0) continue;

        let bp: Breakpoint = 'desktop';
        if (width < 720) bp = 'mobile';
        else if (width < 1340) bp = 'tablet'; // 1280px tablets now get 10 columns (perfect density)
        else if (width < 1920) bp = 'desktop';
        else bp = 'ultra';

        setBreakpoint(bp);

        const cols = colsConfig[bp];
        const gap = bp === 'mobile' ? 8 : 16;
        const unitSize = (width - (gap * (cols - 1))) / cols;

        if (unitSize > 0) {
          setGridUnitSize(unitSize);
          gridRef.current?.style.setProperty('--grid-unit-size', `${unitSize}px`);
        }
      }
    });

    observer.observe(gridRef.current);

    // Initial trigger: Ensure sizing is correct as soon as the view mounts
    const syncSizing = () => {
      if (!gridRef.current) return;
      const width = gridRef.current.offsetWidth;
      if (width <= 0) return;

      let bp: Breakpoint = 'desktop';
      if (width < 720) bp = 'mobile';
      else if (width < 1340) bp = 'tablet';
      else if (width < 1920) bp = 'desktop';
      else bp = 'ultra';

      setBreakpoint(bp);
      const cols = colsConfig[bp];
      const gap = bp === 'mobile' ? 8 : 16;
      const unitSize = (width - (gap * (cols - 1))) / cols;

      if (unitSize > 0) {
        setGridUnitSize(unitSize);
        gridRef.current.style.setProperty('--grid-unit-size', `${unitSize}px`);
      }
    };

    // Run syncSizing immediately and after short delays to account for layout shifts
    syncSizing();
    const t1 = setTimeout(syncSizing, 100);
    const t2 = setTimeout(syncSizing, 500);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeView, loading]);

  // Adaptive Ambiance settings
  const [dayNightCycle, setDayNightCycle] = useState(true);
  const [weatherEffects, setWeatherEffects] = useState<WeatherEffectsMode>('all');

  // Tile Themes setting
  const [tileThemesEnabled, setTileThemesEnabled] = useState(true);

  // Hass states
  const [hassEntities, setHassEntities] = useState<HassEntities>({});
  const [hassConnection, setHassConnection] = useState<Connection | null>(null);
  const [hassState, setHassState] = useState<HassConnectionState>('connecting');
  const [liveHistory, setLiveHistory] = useState<Record<string, { time: string; value: number }[]>>({});

  // Unified WebSocket Caller (memoized to keep downstream useCallback deps stable)
  const callHAWebSocket = useCallback(async (type: string, payload?: Record<string, unknown>): Promise<unknown> => {
    if (hassConnection) {
      // sendMessagePromise is on Connection
      return await hassConnection.sendMessagePromise({ type, ...payload });
    }

    // Fallback to Mock if not connected or Standalone
    console.log(`[HA Mock/Fallback] Calling WebSocket: ${type}`, payload || '');
    if (type === 'nexura/board/get') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { layout: [], title: '' };
    } else if (type === 'nexura/board/save') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        layout: payload?.layout,
        layouts: payload?.layouts,
        title: payload?.title
      }));
      return { success: true };
    }
    throw new Error("Unknown command");
  }, [hassConnection]);

  useEffect(() => {
    // 1. Connect to HA WebSocket
    connectHass(
      (entities) => setHassEntities(entities),
      (state) => setHassState(state)
    ).then(conn => {
      setHassConnection(conn);
    });

    // Safety timeout: If connection takes too long, force loading with fallback data
    const timer = setTimeout(() => {
      setHassState(prev => prev === 'connecting' ? 'error' : prev);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Update live history when entities change
  useEffect(() => {
    if (Object.keys(hassEntities).length === 0) return;

    setLiveHistory(prev => {
      const next = { ...prev };
      let changed = false;

      tiles.forEach(tile => {
        if (tile.type === 'graph' && tile.entityId) {
          const entity = hassEntities[tile.entityId];
          const rawState = entity?.state;
          const newValue = parseFloat(rawState);

          if (entity && !isNaN(newValue)) {
            const history = next[tile.id] || [];
            const lastPoint = history[history.length - 1];

            // Initialization: If no history, add current value immediately
            if (history.length === 0) {
              next[tile.id] = [{
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: newValue
              }];
              changed = true;
            } else if (lastPoint.value !== newValue) {
              // Add new point only if value changed
              const newPoint = {
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: newValue
              };
              // Keep last 40 points for a longer graph
              next[tile.id] = [...history, newPoint].slice(-40);
              changed = true;
            }
          }
        }
      });

      return changed ? next : prev;
    });
  }, [hassEntities, tiles]);

  // Stabilized View Transition Animation
  useEffect(() => {
    if (viewContainerRef.current && !loading) {
      const el = viewContainerRef.current;
      
      // Stop ongoing animations on this container and its tiles
      utils.remove(el);
      const childTiles = el.querySelectorAll('.bento-tile');
      if (childTiles.length > 0) {
        utils.remove(childTiles);
      }

      // Show container near-instantly to avoid overlapping opacity curves
      animate(el, {
        opacity: [0, 1],
        duration: 50,
        easing: 'easeOutQuad'
      });

      // Staggered entrance for each tile, ONLY if not dragging/editing
      if (!isEditMode && !isAnyDragging) {
        if (childTiles.length > 0) {
          animate(childTiles, {
            translateY: [30, 0],
            scale: [0.9, 1],
            opacity: [0, 1],
            delay: stagger(40), // 40ms between each tile
            duration: 800,
            easing: 'easeOutElastic(1, .8)'
          });
        }
      }
    }
  }, [activeView, loading, isEditMode, isAnyDragging]);

  // 2. Load Tiles when connection is ready or if it fails/remains null (standalone)
  useEffect(() => {
    const loadTiles = async () => {
      setLoading(true);
      try {
        const data = await callHAWebSocket('nexura/board/get') as {
          layout: TileData[],
          layouts?: DashboardLayouts,
          title?: string
        };
        let layout: TileData[] = [];
        let savedLayouts: DashboardLayouts = data?.layouts || {};
        let title = data?.title || '';

        layout = data?.layout || [];
        setDashboardTitle(title);

        const finalTiles = (Array.isArray(layout) && layout.length > 0) ? layout : INITIAL_TILES;

        // Auto-migration to v4 (coordinate system) if needed
        const isLegacyFormat = Object.keys(savedLayouts).length === 0 ||
          !Object.values(savedLayouts).some(view => (view as any).desktop);

        if (isLegacyFormat) {
          console.log("[Nexura] Migrating to view-specific coordinate layouts");
          savedLayouts = {}; // Reset to start fresh migration
          // We need to identify all views to migrate
          const views = new Set(['favorites']);
          finalTiles.forEach(t => { if (t.room) views.add(t.room); else views.add('Inconnue'); });

          views.forEach(view => {
            savedLayouts[view] = migrateLayouts(finalTiles, view);
          });
        } else {
          // New: Ensure 'ultra' breakpoint exists for all views in already migrated layouts
          Object.keys(savedLayouts).forEach(view => {
            if (savedLayouts[view].desktop && !savedLayouts[view].ultra) {
              console.log(`[Nexura] Initializing 'ultra' layout for view ${view} from desktop`);
              savedLayouts[view] = {
                ...savedLayouts[view],
                ultra: JSON.parse(JSON.stringify(savedLayouts[view].desktop)) // Deep clone
              };
            }
          });
        }

        const mergedData = finalTiles.map(tile => {
          const initialMatch = INITIAL_TILES.find(it => it.id === tile.id);
          const hasEntity = !!(tile.entityId || initialMatch?.entityId);

          return {
            ...tile,
            type: tile.type || 'info',
            entityId: tile.entityId || initialMatch?.entityId,
            isOn: tile.isOn !== undefined ? tile.isOn : false,
            value: tile.value !== undefined ? tile.value : 0,
            // Only use mock data if NO entity is linked
            graphData: (tile.graphData && tile.graphData.length > 0)
              ? tile.graphData
              : (hasEntity ? [] : mockGraphData)
          };
        });

        setTiles(mergedData);

        // --- Self-Healing Mechanism (Zombie Tile Recovery) ---
        const healedLayouts = { ...savedLayouts };
        let wasHealed = false;

        mergedData.forEach(tile => {
            const tileRoom = (tile.room && tile.room.trim() !== '') ? tile.room : 'Inconnue';
            const viewLayout = healedLayouts[tileRoom] || { ultra: [], desktop: [], tablet: [], mobile: [] };
            
            // Check if tile exists in the layout of its assigned room
            const existsInRoom = viewLayout.desktop?.some(l => l.id === tile.id);
            
            if (!existsInRoom) {
                console.warn(`[Nexura Healing] Tile ${tile.id} (${tile.title}) missing from layout ${tileRoom}. Recovering...`);
                wasHealed = true;
                const dims = getSizeDimensions(tile.size);
                
                // Calculate slots across all breakpoints
                const ultraSlot = findFirstAvailableSlot(viewLayout.ultra || [], dims.w, dims.h, 16);
                const desktopSlot = findFirstAvailableSlot(viewLayout.desktop || [], dims.w, dims.h, 14);
                const tabletW = Math.min(dims.w, 10);
                const tabletSlot = findFirstAvailableSlot(viewLayout.tablet || [], tabletW, dims.h, 10);
                const mobileW = Math.min(dims.w, 6);
                const mobileSlot = findFirstAvailableSlot(viewLayout.mobile || [], mobileW, dims.h, 6);

                healedLayouts[tileRoom] = {
                    ultra: [...(viewLayout.ultra || []), { id: tile.id, ...ultraSlot, w: dims.w, h: dims.h }],
                    desktop: [...(viewLayout.desktop || []), { id: tile.id, ...desktopSlot, w: dims.w, h: dims.h }],
                    tablet: [...(viewLayout.tablet || []), { id: tile.id, ...tabletSlot, w: tabletW, h: dims.h }],
                    mobile: [...(viewLayout.mobile || []), { id: tile.id, ...mobileSlot, w: mobileW, h: dims.h }],
                };
            }

            // Also ensure favorites sync if isFavorite is true
            if (tile.isFavorite) {
                const favLayout = healedLayouts.favorites || { ultra: [], desktop: [], tablet: [], mobile: [] };
                const existsInFav = favLayout.desktop?.some(l => l.id === tile.id);
                if (!existsInFav) {
                    console.warn(`[Nexura Healing] Favorite tile ${tile.id} missing from FAVORITES. Recovering...`);
                    wasHealed = true;
                    const dims = getSizeDimensions(tile.size);
                    const favUltra = findFirstAvailableSlot(favLayout.ultra || [], dims.w, dims.h, 16);
                    const favDesktop = findFirstAvailableSlot(favLayout.desktop || [], dims.w, dims.h, 14);
                    const favTablet = findFirstAvailableSlot(favLayout.tablet || [], Math.min(dims.w, 10), dims.h, 10);
                    const favMobile = findFirstAvailableSlot(favLayout.mobile || [], Math.min(dims.w, 6), dims.h, 6);

                    healedLayouts.favorites = {
                        ultra: [...(favLayout.ultra || []), { id: tile.id, ...favUltra, w: dims.w, h: dims.h }],
                        desktop: [...(favLayout.desktop || []), { id: tile.id, ...favDesktop, w: dims.w, h: dims.h }],
                        tablet: [...(favLayout.tablet || []), { id: tile.id, ...favTablet, w: Math.min(dims.w, 10), h: dims.h }],
                        mobile: [...(favLayout.mobile || []), { id: tile.id, ...favMobile, w: Math.min(dims.w, 6), h: dims.h }],
                    };
                }
            }
        });

        if (wasHealed) {
            console.log("[Nexura Healing] Layout was successfully healed.");
            const payload = { layout: mergedData, layouts: healedLayouts, title: title };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            callHAWebSocket('nexura/board/save', payload).catch(e => console.error(e));
        }

        setLayouts(healedLayouts);
        // Load Config
        try {
          const configRes = await callHAWebSocket('nexura/config/get') as {
            theme: 'auto' | 'dark' | 'light' | 'nature',
            screensaver_enabled?: boolean,
            day_night_cycle?: boolean,
            weather_effects?: WeatherEffectsMode,
            tile_themes_enabled?: boolean,
          };
          if (configRes) {
            if (configRes.theme) setTheme(configRes.theme);
            if (configRes.screensaver_enabled !== undefined) setScreensaverEnabled(configRes.screensaver_enabled);
            if (configRes.day_night_cycle !== undefined) setDayNightCycle(configRes.day_night_cycle);
            if (configRes.weather_effects) setWeatherEffects(configRes.weather_effects);
            if (configRes.tile_themes_enabled !== undefined) setTileThemesEnabled(configRes.tile_themes_enabled);
          }
        } catch (e) {
          console.warn("Could not load nexura config", e);
        }

      } catch (e: unknown) {
        console.error("Failed to load layout", e);
        setTiles(INITIAL_TILES);
      } finally {
        setLoading(false);
      }
    };

    if (hassState !== 'connecting') {
      loadTiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hassConnection, hassState]);

  // Premium Entrance Animation with Anime.js
  useEffect(() => {
    if (!loading && tiles.length > 0) {
      const timer = setTimeout(() => {
        const tileElements = document.querySelectorAll('.bento-grid > .bento-tile');
        if (tileElements.length > 0) {
          // Robust animation: explicitly set start and end values to avoid initial opacity: 0 issues
          animate(tileElements, {
            opacity: [0, 1],
            translateY: [30, 0],
            scale: [0.9, 1],
            delay: stagger(35, { start: 150 }),
            duration: 900,
            easing: 'easeOutQuint',
            // Safety: Ensure tiles are visible even if animation is interrupted
            complete: () => {
              tileElements.forEach(el => {
                (el as HTMLElement).style.opacity = '1';
                (el as HTMLElement).style.transform = '';
              });
            }
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, activeView, tiles.length]);

  useEffect(() => {
    // Apply theme to body
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto', 'theme-nature');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // On restaure la réactivité immédiate pour la poignée dédiée
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);

    // Initial prediction is the current position
    const viewLayout = layouts[activeView] || { desktop: [], tablet: [], mobile: [] };
    const draggingTile = viewLayout[breakpoint].find(l => l.id === id);
    if (draggingTile) {
      setPredictedLayout({ ...draggingTile });
    }
  }, [activeView, breakpoint, layouts]);

  const handleDragOver = useCallback((event: any) => {
    const { active, delta } = event;
    const draggedId = active.id as string;

    const viewLayout = layouts[activeView] || { desktop: [], tablet: [], mobile: [] };
    const currentLayout = viewLayout[breakpoint];
    const tileLayout = currentLayout.find(l => l.id === draggedId);

    if (!tileLayout || !gridUnitSize) return;

    const colsConfig = { ultra: 16, desktop: 14, tablet: 10, mobile: 6 };
    const cols = colsConfig[breakpoint];
    const cellWidth = gridUnitSize;
    const gap = breakpoint === 'mobile' ? 8 : 16;
    const cellHeight = gridUnitSize + gap;

    // Aligned threshold (0.6) for consistent ghost/drop behavior
    const dx = calculateGridOffset(delta.x, cellWidth + gap, 0.6);
    const dy = calculateGridOffset(delta.y, cellHeight, 0.6);

    const newX = Math.max(0, Math.min(cols - tileLayout.w, tileLayout.x + dx));
    const newY = Math.max(0, tileLayout.y + dy);

    // Apply compactLayout to the prediction to match the final placement logic
    const nextEntries = currentLayout.map(l =>
      l.id === draggedId ? { ...l, x: newX, y: newY } : l
    );
    const compacted = compactLayout(nextEntries, draggedId);
    const finalGhost = compacted.find(l => l.id === draggedId);

    // Only update if ghost position actually changed
    if (finalGhost && (!predictedLayout || predictedLayout.x !== finalGhost.x || predictedLayout.y !== finalGhost.y)) {
      setPredictedLayout({ ...finalGhost });
    }
  }, [activeView, breakpoint, layouts, gridUnitSize, predictedLayout]);

  const handleEditClick = () => {
    setBackupTiles([...tiles]);
    setBackupLayouts({ ...layouts });
    setBackupTitle(dashboardTitle);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setTiles(backupTiles);
    setLayouts(backupLayouts);
    setDashboardTitle(backupTitle);
    setIsEditMode(false);
  };

  const handleSaveEdit = () => {
    const payload = { layout: tiles, layouts: layouts, title: dashboardTitle };
    callHAWebSocket('nexura/board/save', payload).catch((e: unknown) => console.error(e));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setIsEditMode(false);
  };

  const handleDeleteTile = useCallback((id: string) => {
    setTiles(prevTiles => {
      const updatedTiles = prevTiles.filter(t => t.id !== id);

      setLayouts(prevLayouts => {
        const updatedLayouts = { ...prevLayouts };
        Object.keys(updatedLayouts).forEach(view => {
          updatedLayouts[view] = {
            ultra: (updatedLayouts[view].ultra || []).filter(l => l.id !== id),
            desktop: (updatedLayouts[view].desktop || []).filter(l => l.id !== id),
            tablet: (updatedLayouts[view].tablet || []).filter(l => l.id !== id),
            mobile: (updatedLayouts[view].mobile || []).filter(l => l.id !== id),
          };
        });

        // Auto-save on delete
        const payload = { layout: updatedTiles, layouts: updatedLayouts, title: dashboardTitle };
        callHAWebSocket('nexura/board/save', payload).catch(e => console.error("[Nexura Debug] Save failed on delete:", e));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        return updatedLayouts;
      });

      return updatedTiles;
    });
  }, [dashboardTitle, callHAWebSocket]);

  const handleOpenEditModal = useCallback((tile: TileData) => {
    setTileToEdit(tile);
    setIsAddModalOpen(true);
  }, []);

  /**
   * Find the first available grid position for a tile of given dimensions.
   * Scans row by row, column by column, and returns the first slot where the
   * tile fits without overlapping any existing layout entries.
   */
  const findFirstAvailableSlot = (
    existingLayout: LayoutEntry[],
    w: number,
    h: number,
    gridCols: number
  ): { x: number; y: number } => {
    // Build an occupancy grid (max 50 rows should be plenty)
    const maxRow = 50;
    const occupied = new Set<string>();

    for (const entry of existingLayout) {
      if (entry.hidden) continue;
      for (let row = entry.y; row < entry.y + entry.h; row++) {
        for (let col = entry.x; col < entry.x + entry.w; col++) {
          occupied.add(`${col},${row}`);
        }
      }
    }

    // Scan row by row, then column by column
    for (let y = 0; y < maxRow; y++) {
      for (let x = 0; x <= gridCols - w; x++) {
        let fits = true;
        for (let dy = 0; dy < h && fits; dy++) {
          for (let dx = 0; dx < w && fits; dx++) {
            if (occupied.has(`${x + dx},${y + dy}`)) {
              fits = false;
            }
          }
        }
        if (fits) return { x, y };
      }
    }

    // Fallback: place below everything
    const maxY = existingLayout.reduce((max, e) => Math.max(max, e.y + e.h), 0);
    return { x: 0, y: maxY };
  };

  const handleAddTile = (newTile: TileData) => {
    if (tileToEdit) {
      setTiles(prevTiles => {
        const updatedTiles = prevTiles.map(t => t.id === tileToEdit.id ? { ...newTile, id: t.id } : t);

        setLayouts(prevLayouts => {
          const updatedLayouts = { ...prevLayouts };
          const oldRoom = (tileToEdit.room && tileToEdit.room.trim() !== '') ? tileToEdit.room : 'Inconnue';
          const newRoom = (newTile.room && newTile.room.trim() !== '') ? newTile.room : 'Inconnue';

          if (oldRoom !== newRoom) {
            // Room changed: Move layout entry from oldRoom to newRoom
            const oldViewLayout = updatedLayouts[oldRoom] || { ultra: [], desktop: [], tablet: [], mobile: [] };

            // Remove from old
            updatedLayouts[oldRoom] = {
              ultra: (oldViewLayout.ultra || []).filter(l => l.id !== tileToEdit.id),
              desktop: (oldViewLayout.desktop || []).filter(l => l.id !== tileToEdit.id),
              tablet: (oldViewLayout.tablet || []).filter(l => l.id !== tileToEdit.id),
              mobile: (oldViewLayout.mobile || []).filter(l => l.id !== tileToEdit.id),
            };

            // Add to new (first available slot)
            const newViewLayout = updatedLayouts[newRoom] || { ultra: [], desktop: [], tablet: [], mobile: [] };
            const dims = getSizeDimensions(newTile.size);
            const ultraSlot = findFirstAvailableSlot(newViewLayout.ultra || [], dims.w, dims.h, 16);
            const desktopSlot = findFirstAvailableSlot(newViewLayout.desktop || [], dims.w, dims.h, 14);
            const tabletW = Math.min(dims.w, 10);
            const tabletSlot = findFirstAvailableSlot(newViewLayout.tablet || [], tabletW, dims.h, 10);
            const mobileW = Math.min(dims.w, 6);
            const mobileSlot = findFirstAvailableSlot(newViewLayout.mobile || [], mobileW, dims.h, 6);

            updatedLayouts[newRoom] = {
              ultra: [...(newViewLayout.ultra || []), { id: tileToEdit.id, ...ultraSlot, w: dims.w, h: dims.h }],
              desktop: [...(newViewLayout.desktop || []), { id: tileToEdit.id, ...desktopSlot, w: dims.w, h: dims.h }],
              tablet: [...(newViewLayout.tablet || []), { id: tileToEdit.id, ...tabletSlot, w: tabletW, h: dims.h }],
              mobile: [...(newViewLayout.mobile || []), { id: tileToEdit.id, ...mobileSlot, w: mobileW, h: dims.h }],
            };
            
            // Auto-switch to new room
            setActiveView(newRoom);
          } else {
            // Room stayed the same: Just update dimensions in current view
            const viewLayout = updatedLayouts[activeView] || { ultra: [], desktop: [], tablet: [], mobile: [] };
            const updateLayoutEntry = (layoutArr: LayoutEntry[]) => (layoutArr || []).map(l =>
              l.id === tileToEdit.id ? { ...l, w: getSizeDimensions(newTile.size).w, h: getSizeDimensions(newTile.size).h } : l
            );

            updatedLayouts[activeView] = {
              ultra: updateLayoutEntry(viewLayout.ultra),
              desktop: updateLayoutEntry(viewLayout.desktop),
              tablet: updateLayoutEntry(viewLayout.tablet),
              mobile: updateLayoutEntry(viewLayout.mobile),
            };
          }

          // Sync Favorites
          if (newTile.isFavorite) {
            const favLayout = updatedLayouts.favorites || { ultra: [], desktop: [], tablet: [], mobile: [] };
            const exists = favLayout.desktop?.some(l => l.id === tileToEdit.id);
            if (!exists) {
              const dims = getSizeDimensions(newTile.size);
              const fU = findFirstAvailableSlot(favLayout.ultra || [], dims.w, dims.h, 16);
              const fD = findFirstAvailableSlot(favLayout.desktop || [], dims.w, dims.h, 14);
              const fT = findFirstAvailableSlot(favLayout.tablet || [], Math.min(dims.w, 10), dims.h, 10);
              const fM = findFirstAvailableSlot(favLayout.mobile || [], Math.min(dims.w, 6), dims.h, 6);
              updatedLayouts.favorites = {
                ultra: [...(favLayout.ultra || []), { id: tileToEdit.id, ...fU, w: dims.w, h: dims.h }],
                desktop: [...(favLayout.desktop || []), { id: tileToEdit.id, ...fD, w: dims.w, h: dims.h }],
                tablet: [...(favLayout.tablet || []), { id: tileToEdit.id, ...fT, w: Math.min(dims.w, 10), h: dims.h }],
                mobile: [...(favLayout.mobile || []), { id: tileToEdit.id, ...fM, w: Math.min(dims.w, 6), h: dims.h }],
              };
            }
          } else {
            // Remove from favorites if unchecked
            updatedLayouts.favorites = {
              ultra: (updatedLayouts.favorites?.ultra || []).filter(l => l.id !== tileToEdit.id),
              desktop: (updatedLayouts.favorites?.desktop || []).filter(l => l.id !== tileToEdit.id),
              tablet: (updatedLayouts.favorites?.tablet || []).filter(l => l.id !== tileToEdit.id),
              mobile: (updatedLayouts.favorites?.mobile || []).filter(l => l.id !== tileToEdit.id),
            };
          }

          // Auto-save on edit
          const payload = { layout: updatedTiles, layouts: updatedLayouts, title: dashboardTitle };
          callHAWebSocket('nexura/board/save', payload).catch(e => console.error("[Nexura Debug] Save failed on edit:", e));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

          return updatedLayouts;
        });

        return updatedTiles;
      });
      setTileToEdit(null);
    } else {
      // Add new tile
      const dims = getSizeDimensions(newTile.size);
      console.log("[Nexura Debug] handleAddTile -> newTile:", newTile, "dims:", dims);

      const targetRoom = newTile.room || activeView;
      setTiles(prevTiles => {
        const updatedTiles = [...prevTiles, newTile];
        console.log("[Nexura Debug] handleAddTile -> updatedTiles count:", updatedTiles.length);

        setLayouts(prevLayouts => {
          const updatedLayouts = { ...prevLayouts };

          if (activeView === 'favorites') {
            newTile.isFavorite = true;
          }

          const viewLayout = updatedLayouts[targetRoom] || { ultra: [], desktop: [], tablet: [], mobile: [] };
          const ultraSlot = findFirstAvailableSlot(viewLayout.ultra || [], dims.w, dims.h, 16);
          const desktopSlot = findFirstAvailableSlot(viewLayout.desktop || [], dims.w, dims.h, 12);
          const tabletW = Math.min(dims.w, 8);
          const tabletSlot = findFirstAvailableSlot(viewLayout.tablet || [], tabletW, dims.h, 8);
          const mobileW = Math.min(dims.w, 4);
          const mobileSlot = findFirstAvailableSlot(viewLayout.mobile || [], mobileW, dims.h, 4);

          updatedLayouts[targetRoom] = {
            ...viewLayout,
            ultra: [...(viewLayout.ultra || []), { id: newTile.id, ...ultraSlot, w: dims.w, h: dims.h }],
            desktop: [...(viewLayout.desktop || []), { id: newTile.id, ...desktopSlot, w: dims.w, h: dims.h }],
            tablet: [...(viewLayout.tablet || []), { id: newTile.id, ...tabletSlot, w: tabletW, h: dims.h }],
            mobile: [...(viewLayout.mobile || []), { id: newTile.id, ...mobileSlot, w: mobileW, h: dims.h }],
          };

          if (newTile.isFavorite && targetRoom !== 'favorites') {
            const favLayout = updatedLayouts.favorites || { ultra: [], desktop: [], tablet: [], mobile: [] };
            const favUltra = findFirstAvailableSlot(favLayout.ultra || [], dims.w, dims.h, 16);
            const favDesktop = findFirstAvailableSlot(favLayout.desktop || [], dims.w, dims.h, 12);
            const favTablet = findFirstAvailableSlot(favLayout.tablet || [], tabletW, dims.h, 8);
            const favMobile = findFirstAvailableSlot(favLayout.mobile || [], mobileW, dims.h, 4);
            updatedLayouts.favorites = {
              ultra: [...(favLayout.ultra || []), { id: newTile.id, ...favUltra, w: dims.w, h: dims.h }],
              desktop: [...(favLayout.desktop || []), { id: newTile.id, ...favDesktop, w: dims.w, h: dims.h }],
              tablet: [...(favLayout.tablet || []), { id: newTile.id, ...favTablet, w: tabletW, h: dims.h }],
              mobile: [...(favLayout.mobile || []), { id: newTile.id, ...favMobile, w: mobileW, h: dims.h }],
            };
          }

          // Auto-save on add
          const payload = { layout: updatedTiles, layouts: updatedLayouts, title: dashboardTitle };
          console.log("[Nexura Debug] Auto-saving new tile:", newTile.id, "to room:", targetRoom);
          callHAWebSocket('nexura/board/save', payload)
            .then(() => console.log("[Nexura Debug] Save successful"))
            .catch(e => console.error("[Nexura Debug] Save failed on add:", e));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

          return updatedLayouts;
        });

        return updatedTiles;
      });
      // Switch view to the room where the tile was added
      setActiveView(targetRoom);
    }
    setIsAddModalOpen(false);
  };

  const handleResizeTile = useCallback((id: string) => {
    setLayouts(prev => {
      const updated = { ...prev };
      const viewLayout = updated[activeView] || { desktop: [], tablet: [], mobile: [] };
      const currentLayout = viewLayout[breakpoint];

      const updatedEntries = currentLayout.map(t => {
        if (t.id === id) {
          const tileInfo = tiles.find(ti => ti.id === id);
          const sizes: TileSize[] = ['small', 'rect', 'square', 'large-rect', 'large-square'];

          // Find which "standard" size this matches (approx)
          let currentSize: TileSize = 'small';
          for (const s of sizes) {
            const d = getSizeDimensions(s);
            if (d.w === t.w && d.h === t.h) {
              currentSize = s;
              break;
            }
          }

          if (tileInfo?.type === 'cover' || tileInfo?.type === 'slider' || tileInfo?.type === 'media') {
            // Skip small if it was allowed somehow
          }

          const nextIndex = (sizes.indexOf(currentSize) + 1) % sizes.length;
          const nextSize = sizes[nextIndex];
          const nextDims = getSizeDimensions(nextSize);

          const colsConfig: Record<Breakpoint, number> = { ultra: 16, desktop: 14, tablet: 10, mobile: 6 };
          const cols = colsConfig[breakpoint];

          const newW = Math.min(nextDims.w, cols);
          return {
            ...t,
            w: newW,
            h: nextDims.h
          };
        }
        return t;
      });

      const compacted = compactLayout(updatedEntries, id);
      updated[activeView] = {
        ...viewLayout,
        [breakpoint]: compacted
      };
      return updated;
    });
  }, [activeView, breakpoint, tiles]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    const draggedId = active.id as string;

    setLayouts(prev => {
      const updated = { ...prev };
      const viewLayout = updated[activeView] || { desktop: [], tablet: [], mobile: [] };
      const currentLayout = viewLayout[breakpoint];

      const tileLayout = currentLayout.find(l => l.id === draggedId);
      if (!tileLayout) return prev;

      const cols = { ultra: 16, desktop: 14, tablet: 10, mobile: 6 }[breakpoint];


      const cellWidth = gridUnitSize;
      const gap = breakpoint === 'mobile' ? 8 : 16;
      const cellHeight = gridUnitSize + gap; // unit + gap

      // Aligned threshold (0.6) for consistent ghost/drop behavior
      const dx = calculateGridOffset(delta.x, cellWidth + gap, 0.6);
      const dy = calculateGridOffset(delta.y, cellHeight, 0.6);

      const newX = Math.max(0, Math.min(cols - tileLayout.w, tileLayout.x + dx));
      const newY = Math.max(0, tileLayout.y + dy);

      const nextEntries = currentLayout.map(l =>
        l.id === draggedId ? { ...l, x: newX, y: newY } : l
      );

      const compacted = compactLayout(nextEntries, draggedId);

      updated[activeView] = {
        ...viewLayout,
        [breakpoint]: compacted
      };

      return updated;
    });

    setActiveId(null);
    setPredictedLayout(null);
  }, [activeView, breakpoint, gridUnitSize]);

  const handleToggle = useCallback((id: string, newState: boolean, entityId?: string) => {
    setTiles(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, isOn: newState } : t);
      const dataToSave = { layout: updated, layouts: layouts, title: dashboardTitle };
      callHAWebSocket('nexura/board/save', dataToSave).catch((e: unknown) => console.error(e));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      return updated;
    });

    if (entityId) {
      const domain = entityId.split('.')[0];
      const service = newState ? 'turn_on' : 'turn_off';
      executeService(hassConnection, domain, service, { entity_id: entityId });
    }
  }, [dashboardTitle, layouts, hassConnection, callHAWebSocket]);

  const handleSliderChange = (id: string, newValue: number, entityId?: string) => {
    setTiles(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, value: newValue } : t);
      const dataToSave = { layout: updated, layouts: layouts, title: dashboardTitle };
      callHAWebSocket('nexura/board/save', dataToSave).catch((e: unknown) => console.error(e));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      return updated;
    });

    if (entityId) {
      const domain = entityId.split('.')[0];
      const brightness = Math.round((newValue / 100) * 255);
      executeService(hassConnection, domain, 'turn_on', {
        entity_id: entityId,
        brightness
      });
    }
  };

  const handleCoverAction = (action: 'open' | 'close' | 'stop', entityId?: string) => {
    if (entityId) {
      const service = action === 'open' ? 'open_cover' : action === 'close' ? 'close_cover' : 'stop_cover';
      executeService(hassConnection, 'cover', service, {
        entity_id: entityId
      });
    }
  };

  const handleMediaAction = (action: 'play' | 'pause' | 'previous' | 'next' | 'power', entityId?: string) => {
    if (entityId) {
      const domain = 'media_player';
      let service = '';
      switch (action) {
        case 'play': service = 'media_play'; break;
        case 'pause': service = 'media_pause'; break;
        case 'previous': service = 'media_previous_track'; break;
        case 'next': service = 'media_next_track'; break;
        case 'power': service = 'turn_off'; break;
      }
      executeService(hassConnection, domain, service, { entity_id: entityId });
    }
  };

  const handleSceneTrigger = useCallback((entityId?: string) => {
    if (entityId) {
      executeService(hassConnection, 'scene', 'turn_on', { entity_id: entityId });
    }
  }, [hassConnection]);

  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };



  const rooms = useMemo(() => {
    const r = new Set<string>();
    let hasRoomless = false;
    
    // We only want to show rooms that actually have tiles in the current layout
    // (A tile might be in the 'tiles' array but effectively deleted/hidden from layout)
    tiles.forEach(t => {
      // Check if tile is actually present in its room's layout
      const roomKey = (t.room && t.room.trim() !== '') ? t.room : 'Inconnue';
      const viewLayout = layouts[roomKey]?.[breakpoint] || layouts[roomKey]?.['desktop'] || [];
      const isInLayout = viewLayout.some(entry => entry.id === t.id && (!entry.hidden || isEditMode));

      if (isInLayout) {
        if (roomKey !== 'Inconnue') {
          r.add(roomKey);
        } else {
          hasRoomless = true;
        }
      }
    });

    const sortedRooms = Array.from(r).sort();
    if (hasRoomless) {
      sortedRooms.push('Inconnue');
    }
    return sortedRooms;
  }, [tiles, layouts, breakpoint, isEditMode]);

  // Memoize to avoid recalculating on every render (drag frames)
  const currentLayoutEntries = useMemo(
    () => layouts[activeView]?.[breakpoint] || layouts[activeView]?.['desktop'] || [],
    [layouts, activeView, breakpoint]
  );

  const orderedAndFilteredTiles = useMemo(() => {
    // 1. Initial Filtering (Visibility Rules & Room/Favorites)
    const visibleTiles: (TileData & { layout: LayoutEntry })[] = [];
    
    for (const entry of currentLayoutEntries) {
      const tileData = tiles.find(t => t.id === entry.id);
      if (!tileData) continue;

      const combined = { ...tileData, layout: { ...entry } };

      // Filter by hidden state (user override)
      if (entry.hidden && !isEditMode) continue;

      // Filter by predictive visibility rules (Favorites only)
      if (!isEditMode && activeView === 'favorites') {
        const allRules = [
          ...(tileData.visibilityRule ? [ { ...tileData.visibilityRule, type: 'entity' } as VisibilityRule ] : []),
          ...(tileData.visibilityRules || [])
        ];

        if (allRules.length > 0) {
          let isTileVisible = true;
          for (const rule of allRules) {
            if (rule.type === 'entity') {
              const { entityId, operator, value } = rule;
              const entity = hassEntities[entityId];
              let isRuleMet = false;
              if (entity) {
                const stateValue = entity.state;
                const numStateValue = parseFloat(stateValue);
                const numTargetValue = parseFloat(value);
                const isNumeric = !isNaN(numStateValue) && !isNaN(numTargetValue);
                switch (operator) {
                  case '=': isRuleMet = stateValue === value; break;
                  case '!=': isRuleMet = stateValue !== value; break;
                  case '>': isRuleMet = isNumeric ? numStateValue > numTargetValue : stateValue > value; break;
                  case '<': isRuleMet = isNumeric ? numStateValue < numTargetValue : stateValue < value; break;
                }
              }
              if (!isRuleMet) { isTileVisible = false; break; }
            } else if (rule.type === 'time') {
              const { startTime, endTime } = rule;
              const now = new Date();
              const currentTime = now.getHours() * 60 + now.getMinutes();
              const parseTime = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
              const start = parseTime(startTime);
              const end = parseTime(endTime);
              const isRuleMet = start <= end ? (currentTime >= start && currentTime <= end) : (currentTime >= start || currentTime <= end);
              if (!isRuleMet) { isTileVisible = false; break; }
            }
          }
          if (!isTileVisible) continue;
        }
      }

      // Filter by active view
      if (activeView === 'favorites') {
        if (combined.isFavorite) visibleTiles.push(combined);
      } else if (activeView === 'Inconnue') {
        if (!combined.room || combined.room.trim() === '' || combined.room === 'Inconnue') visibleTiles.push(combined);
      } else if (combined.room === activeView) {
        visibleTiles.push(combined);
      }
    }

    // If Edit Mode or not in favorites, return simple layout
    if (isEditMode) return visibleTiles;

    // 2. Reflow Algorithm (Anchor-Row logic)
    // Identify tiles that are hidden by rules (but were supposed to be there)
    const ruleHiddenTiles = currentLayoutEntries
      .filter(entry => {
        const tileData = tiles.find(t => t.id === entry.id);
        if (!tileData) return false;
        // It's "rule hidden" if it's NOT in visibleTiles but IS in currentLayoutEntries (and not manually hidden)
        return !entry.hidden && !visibleTiles.some(vt => vt.id === entry.id);
      })
      .map(entry => ({ x: entry.x, y: entry.y, w: entry.w, h: entry.h, id: entry.id }));

    // Sort visible tiles by Y then X
    const sortedVisible = [...visibleTiles].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
    
    // Process each visible tile
    const reflowedResult: (TileData & { layout: LayoutEntry })[] = [];
    
    sortedVisible.forEach(tile => {
      // Anchors (h > 2) stay fixed
      if (tile.layout.h > 2) {
        reflowedResult.push(tile);
        return;
      }

      // Fluids (h <= 2) shift left based on hidden tiles on the same row
      const originalX = tile.layout.x;
      const originalY = tile.layout.y;
      
      // Find hidden tiles on the same row that were to the left
      const hiddenToLeft = ruleHiddenTiles.filter(h => h.y === originalY && h.x < originalX);
      const shift = hiddenToLeft.reduce((sum, h) => sum + h.w, 0);

      if (shift > 0) {
        tile.layout.x = Math.max(0, originalX - shift);
      }
      reflowedResult.push(tile);
    });

    // 3. Vertical Compression (Remove entirely empty rows)
    const finalResult = [...reflowedResult];
    // Re-calculate occupancy for visible tiles after horizontal shift
    const usedRows = new Set<number>();
    finalResult.forEach(t => {
      for (let i = t.layout.y; i < t.layout.y + t.layout.h; i++) usedRows.add(i);
    });

    const sortedUsedRows = Array.from(usedRows).sort((a, b) => a - b);
    if (sortedUsedRows.length > 0) {
      const rowOffsetMap: { [y: number]: number } = {};
      let currentOffset = 0;
      const maxRow = Math.max(...sortedUsedRows);
      
      for (let y = 0; y <= maxRow; y++) {
        if (!usedRows.has(y)) {
          currentOffset++;
        }
        rowOffsetMap[y] = currentOffset;
      }

      finalResult.forEach(tile => {
        tile.layout.y -= rowOffsetMap[tile.layout.y] || 0;
      });
    }

    return finalResult;
  }, [tiles, currentLayoutEntries, activeView, isEditMode, hassEntities, breakpoint]);

  const roomAlerts = useMemo(() => {
    const alerts: { [key: string]: boolean } = {};
    rooms.forEach(room => {
      const roomTiles = room === 'Inconnue'
        ? tiles.filter(t => !t.room || t.room.trim() === '')
        : tiles.filter(t => t.room === room);
      alerts[room] = roomTiles.some(t => getHaloType(t.entityId, hassEntities) === 'danger');
    });
    return alerts;
  }, [tiles, rooms, hassEntities]);

  const roomLightStates = useMemo(() => {
    const lightStates: { [key: string]: boolean } = {};
    rooms.forEach(room => {
      const roomTiles = room === 'Inconnue'
        ? tiles.filter(t => !t.room || t.room.trim() === '')
        : tiles.filter(t => t.room === room);
      
      lightStates[room] = roomTiles.some(t => {
        const entity = t.entityId ? hassEntities[t.entityId] : null;
        if (!entity) return false;
        
        // Consider it a light if type is toggle/slider or domain is light
        const isLight = t.type === 'toggle' || t.type === 'slider' || t.entityId?.startsWith('light.');
        const isOn = entity.state === 'on';
        
        return isLight && isOn;
      });
    });
    return lightStates;
  }, [tiles, rooms, hassEntities]);

  const handleToggleFavorite = useCallback((id: string) => {
    setTiles(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t);
      const tile = updated.find(t => t.id === id);

      if (tile?.isFavorite) {
        // Add to favorites layout if not already there
        setLayouts(lPrev => {
          if (lPrev.favorites?.desktop.some(entry => entry.id === id)) return lPrev;

          const dims = getSizeDimensions(tile.size);
          const updatedLayouts = { ...lPrev };
          const favLayout = updatedLayouts.favorites || { ultra: [], desktop: [], tablet: [], mobile: [] };

          updatedLayouts.favorites = {
            ultra: [...favLayout.ultra, { id, x: 0, y: 0, w: dims.w, h: dims.h }],
            desktop: [...favLayout.desktop, { id, x: 0, y: 0, w: dims.w, h: dims.h }],
            tablet: [...favLayout.tablet, { id, x: 0, y: 0, w: Math.min(dims.w, 8), h: dims.h }],
            mobile: [...favLayout.mobile, { id, x: 0, y: 0, w: Math.min(dims.w, 4), h: dims.h }],
          };
          return updatedLayouts;
        });
      }
      return updated;
    });
  }, []);

  const sortableItems = useMemo(() => orderedAndFilteredTiles.map(t => t.id), [orderedAndFilteredTiles]);

  const activeTile = activeId ? orderedAndFilteredTiles.find(t => t.id === activeId) : null;

  // Tracks whether any tile drag is in progress (used to disable
  // expensive animations on sibling tiles during drag)

  // Apply day/night gradient to body background (Only for dark theme)
  // (must be called before any conditional returns — rules of hooks)
  useTimeGradient(theme === 'dark' ? dayNightCycle : false);

  // Find the first weather entity for overlay effects
  const weatherEntityState = useMemo(() => {
    const weatherEntity = Object.entries(hassEntities).find(
      ([id]) => id.startsWith('weather.')
    );
    return weatherEntity ? weatherEntity[1].state : '';
  }, [hassEntities]);

  if (loading) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>{t('welcome')}</h1>
        </header>
        <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'rgba(255,255,255,0.7)' }}>
          Chargement du dashboard...
        </main>
      </div>
    );
  }

  const renderTileContent = (tile: TileData) => {
    const entity = tile.entityId ? hassEntities[tile.entityId] : null;

    switch (tile.type) {
      case 'toggle': {
        const isOn = entity ? entity.state === 'on' : !!tile.isOn;
        const label = entity ? (isOn ? 'Allumé' : 'Éteint') : (tile.isOn ? 'Lumières allumées' : 'Éteint');
        return (
          <ToggleContent
            isOn={isOn}
            onToggle={(state) => handleToggle(tile.id, state, tile.entityId)}
            label={label}
            isEditMode={isEditMode}
          />
        );
      }
      case 'slider': {
        const value = entity?.attributes?.brightness ? Math.round((entity.attributes.brightness / 255) * 100) : (tile.value || 0);
        const isOn = entity ? entity.state === 'on' : !!tile.isOn;
        return (
          <SliderContent
            value={value}
            isOn={isOn}
            onChange={(val) => handleSliderChange(tile.id, val, tile.entityId)}
            onToggle={(state) => handleToggle(tile.id, state, tile.entityId)}
            label={entity?.attributes?.friendly_name || "Luminosité"}
            isEditMode={isEditMode}
          />
        );
      }
      case 'graph': {
        const unit = entity?.attributes?.unit_of_measurement || '';
        const currentValue = entity ? `${entity.state} ${unit}`.trim() : (tile.content || '');
        // Combine persisted graph data with live history
        const history = liveHistory[tile.id] || [];
        const displayData = history.length > 0 ? history : (tile.entityId ? [] : (tile.graphData || []));

        return (
          <GraphContent
            data={displayData}
            label={entity?.attributes?.friendly_name || tile.title}
            currentValue={currentValue}
            color={tile.graphColor || '#00ff88'}
            isEditMode={isEditMode}
          />
        );
      }
      case 'scene':
        return (
          <SceneContent
            onTrigger={() => handleSceneTrigger(tile.entityId)}
            isEditMode={isEditMode}
          />
        );
      case 'info':
      default: {
        const deviceClass = entity?.attributes?.device_class;
        const unit = entity?.attributes?.unit_of_measurement || '';

        // Special rendering for Temperature and Humidity
        if (deviceClass === 'temperature' || deviceClass === 'humidity' || unit === '°C' || unit === '°F' || unit === '%') {
          return (
            <SensorContent
              value={entity?.state || tile.content || '0'}
              unit={unit}
              label={deviceClass === 'temperature' ? 'Température' : (deviceClass === 'humidity' ? 'Humidité' : undefined)}
            />
          );
        }

        // Presence / Motion specialized rendering
        if (deviceClass === 'motion' || deviceClass === 'presence' || deviceClass === 'occupancy') {
          return (
            <MotionAlertContent
              state={entity?.state || 'off'}
              lastChanged={entity?.last_changed}
            />
          );
        }

        // Special rendering for Windows and Doors
        if (deviceClass === 'window' || deviceClass === 'door' || deviceClass === 'garage_door' || deviceClass === 'opening') {
          const isOpen = entity ? (entity.state === 'on' || entity.state === 'open') : false;
          return (
            <SensorContent
              value={isOpen ? 'Ouvert' : 'Fermé'}
              variant={isOpen ? 'danger' : 'info'}
              label={deviceClass === 'window' ? 'Fenêtre' : (deviceClass === 'door' ? 'Porte' : 'Ouverture')}
            />
          );
        }

        // Special rendering for Weather domain
        if (tile.entityId?.startsWith('weather.')) {
          return (
            <WeatherContent
              entity={entity}
              size={tile.size || 'small'}
            />
          );
        }

        // Special rendering for Camera domain (fallback if type != 'camera')
        if (tile.entityId?.startsWith('camera.')) {
          return (
            <CameraContent entity={entity} connection={hassConnection} />
          );
        }

        const content = entity ? `${entity.state} ${unit}` : (tile.content || '');
        return (
          <>
            <p>{content}</p>
          </>
        );
      }
      case 'media':
        return (
          <MediaContent
            entity={entity}
            onAction={(action) => handleMediaAction(action, tile.entityId)}
          />
        );
      case 'cover':
        return <CoverContent
          entity={entity}
          onAction={(action) => handleCoverAction(action, tile.entityId)}
          size={tile.size}
        />;
      case 'energy-gauge': {
        const power = entity ? parseFloat(entity.state) || 0 : 0;
        const unit = entity?.attributes?.unit_of_measurement || 'W';
        return (
          <EnergyGaugeContent
            value={power}
            maxValue={tile.maxPower || 5000}
            unit={unit}
            label={entity?.attributes?.friendly_name || tile.title}
          />
        );
      }
      case 'energy-flow':
        return (
          <EnergyFlowContent
            hassEntities={hassEntities}
            solarEntityId={tile.solarEntityId}
            gridEntityId={tile.gridEntityId || tile.entityId}
            batteryEntityId={tile.batteryEntityId}
            batteryLevelEntityId={tile.batteryLevelEntityId}
            homeEntityId={undefined}
          />
        );
      case 'camera':
        return (
          <CameraContent entity={entity} connection={hassConnection} />
        );
      case 'fire-alert': {
        const isOn = entity ? (entity.state === 'on' || entity.state === 'tripped') : false;
        return (
          <FireAlertContent
            isOn={isOn}
            isEditMode={isEditMode}
          />
        );
      }
    }
  };

  return (
    <div className={`app-layout ${isFullScreen ? 'is-fullscreen' : ''}`} >
      {/* Adaptive Ambiance — weather overlay effects */}
      {weatherEffects !== 'off' && weatherEntityState && (
        <WeatherOverlay
          weatherState={weatherEntityState}
          mode={weatherEffects}
        />
      )}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      <Sidebar
        rooms={rooms}
        activeView={activeView}
        onViewChange={(view) => {
          setActiveView(view);
          setIsSidebarOpen(false); // Close on selection
        }}
        isEditMode={isEditMode}
        roomAlerts={roomAlerts}
        roomLightStates={roomLightStates}
        isFullScreen={isFullScreen}
        onToggleFullScreen={handleToggleFullScreen}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="app-container">
        <header className="app-header">
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Menu"
          >
            <DynamicIcon name="Menu" size={24} />
          </button>
          <div className="header-content-left">
            <div className="title-row">
              {isEditMode ? (
                <input
                  type="text"
                  className="dashboard-title-input"
                  value={dashboardTitle}
                  onChange={(e) => setDashboardTitle(e.target.value)}
                  placeholder={t('welcome')}
                />
              ) : (
                <h1>{dashboardTitle || t('welcome')}</h1>
              )}
              <div className="header-actions">
                {!isEditMode ? (
                  <button className="btn-dashboard-edit" onClick={handleEditClick}>
                    {t('board.edit_mode')}
                  </button>
                ) : (
                  <div className="edit-controls">
                    <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>+ {t('add_tile_modal.add')}</button>
                    <button className="btn-secondary" onClick={handleCancelEdit}>{t('board.cancel')}</button>
                    <button className="btn-primary" onClick={handleSaveEdit}>{t('board.save')}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <FloatingStatusBar
          tiles={tiles}
          hassEntities={hassEntities}
          onToggleLight={handleToggle}
          onCoverAction={handleCoverAction}
        />

        <main>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragMove={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
            autoScroll={false}
          >
            <div
              key={activeView}
              className={`view-container ${tiles.length === 0 ? 'empty-dashboard' : ''}`}
              ref={viewContainerRef}
              style={{ opacity: 0 }} // Pre-set to 0 to avoid flicker
            >
              {tiles.length === 0 ? (
                <div className="empty-state-container">
                  <DynamicIcon name="PlusCircle" size={48} />
                  <p>{t('board.empty_hint') || "Aucune tuile. Ajoutez-en une pour commencer !"}</p>
                  <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>{t('add_tile_modal.add')}</button>
                </div>
              ) : (
                <SortableContext
                  items={sortableItems}
                  strategy={rectSortingStrategy}
                >
                  <BentoGrid
                    ref={gridRef}
                    style={{
                      '--grid-unit-size': `${gridUnitSize}px`,
                      '--grid-gap': breakpoint === 'mobile' ? '0.5rem' : '1rem',
                      '--grid-cols': breakpoint === 'ultra' ? 16 : breakpoint === 'desktop' ? 14 : breakpoint === 'tablet' ? 10 : 6
                    } as React.CSSProperties}
                  >
                    {/* Ghost/Magnet Placeholder */}
                    {isAnyDragging && predictedLayout && (
                      <BentoTile
                        id="ghost-placeholder"
                        layout={predictedLayout}
                        className="tile-placeholder"
                        isOverlay={false}
                        hideHeader={true}
                      />
                    )}

                    {orderedAndFilteredTiles.map((tile) => {
                      const entity = tile.entityId ? hassEntities[tile.entityId] : null;

                      // Resolve icon and color automatically if not explicitly set
                      const resolvedIcon = tile.icon || (entity ? getAutoIcon(tile.entityId, entity.state, entity.attributes?.device_class as string, entity.attributes?.unit_of_measurement as string) : (tile.room ? getRoomIcon(tile.room) : 'HelpCircle'));
                      const resolvedColor = tile.color || (entity ? getAutoColor(tile.entityId, entity.state, entity.attributes?.device_class as string) : '#00ff88');

                      return (
                        <BentoTile
                          key={tile.id}
                          id={tile.id}
                          layout={tile.layout}
                          title={tile.title}
                          type={tile.type}
                          icon={resolvedIcon}
                          color={resolvedColor}
                          entityId={tile.entityId}
                          hassEntities={hassEntities}
                          isEditMode={isEditMode}
                          isFavorite={tile.isFavorite}
                          className={tile.layout.hidden ? 'tile-hidden' : ''}
                          onDelete={() => handleDeleteTile(tile.id)}
                          onResize={() => handleResizeTile(tile.id)}
                          onEdit={() => handleOpenEditModal(tile)}
                          onToggleFavorite={() => handleToggleFavorite(tile.id)}
                          onClick={() => {
                            if (tile.type === 'toggle') handleToggle(tile.id, !tile.isOn, tile.entityId);
                          }}
                          noPadding={
                            tile.entityId?.startsWith('weather.') || 
                            tile.entityId?.startsWith('camera.') || 
                            tile.type === 'media' || 
                            tile.type === 'camera' || 
                            tile.type === 'fire-alert' ||
                            entity?.attributes?.device_class === 'motion' ||
                            entity?.attributes?.device_class === 'presence' ||
                            entity?.attributes?.device_class === 'occupancy'
                          }
                          hideHeader={
                            tile.entityId?.startsWith('weather.') || 
                            tile.entityId?.startsWith('camera.') || 
                            tile.type === 'graph' || 
                            tile.type === 'media' || 
                            tile.type === 'camera' || 
                            tile.type === 'fire-alert' ||
                            entity?.attributes?.device_class === 'motion' ||
                            entity?.attributes?.device_class === 'presence' ||
                            entity?.attributes?.device_class === 'occupancy'
                          }
                          tileTheme={tileThemesEnabled ? tile.tileTheme : undefined}
                          entityState={tile.entityId ? hassEntities[tile.entityId]?.state : undefined}
                          isPredictive={!!tile.visibilityRule}
                          isAnyDragging={isAnyDragging}
                        >
                          {renderTileContent(tile)}
                        </BentoTile>
                      );
                    })}
                  </BentoGrid>
                </SortableContext>
              )}
            </div>

            <DragOverlay dropAnimation={DROP_ANIMATION} adjustScale={false}>
              {activeTile ? (
                <BentoTile
                  id={activeTile.id}
                  layout={activeTile.layout}
                  title={activeTile.title}
                  type={activeTile.type}
                  icon={activeTile.icon}
                  color={activeTile.color}
                  entityId={activeTile.entityId}
                  hassEntities={hassEntities}
                  isOverlay
                  isEditMode={isEditMode}
                  noPadding={activeTile.entityId?.startsWith('weather.') || activeTile.entityId?.startsWith('camera.') || activeTile.type === 'media' || activeTile.type === 'camera' || activeTile.type === 'fire-alert'}
                  hideHeader={activeTile.entityId?.startsWith('weather.') || activeTile.entityId?.startsWith('camera.') || activeTile.type === 'graph' || activeTile.type === 'media' || activeTile.type === 'camera' || activeTile.type === 'fire-alert'}
                >
                  {renderTileContent(activeTile)}
                </BentoTile>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>

        <AddTileModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setTileToEdit(null);
          }}
          onAdd={handleAddTile}
          tileToEdit={tileToEdit || undefined}
          hassEntities={hassEntities}
          defaultRoom={activeView !== 'favorites' ? activeView : undefined}
        />
      </div>

      {isInactive && !isEditMode && screensaverEnabled && <ScreenSaver entities={hassEntities} />}
    </div >
  )
}

export default App
