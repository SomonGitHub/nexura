import { AnimatePresence, motion } from 'framer-motion'
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
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { connectHass, executeService, type HassConnectionState } from './services/hass';
import { BentoGrid } from './components/BentoGrid/BentoGrid'
import { BentoTile, type TileSize } from './components/BentoTile/BentoTile'
import { ToggleContent } from './components/Tiles/ToggleContent'
import { SliderContent } from './components/Tiles/SliderContent'
import { GraphContent } from './components/Tiles/GraphContent'
import { SensorContent } from './components/Tiles/SensorContent'
import { AddTileModal } from './components/AddTileModal/AddTileModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ScreenSaver } from './components/ScreenSaver/ScreenSaver'
import { WeatherContent } from './components/Tiles/WeatherContent'
import { CoverContent } from './components/Tiles/CoverContent'
import { MediaContent } from './components/Tiles/MediaContent'
import { EnergyGaugeContent } from './components/Tiles/EnergyGaugeContent'
import { EnergyFlowContent } from './components/Tiles/EnergyFlowContent'
import { WeatherOverlay, type WeatherEffectsMode } from './components/WeatherOverlay/WeatherOverlay'
import { getHaloType } from './hooks/useTileStatus'
import { getAutoIcon, getAutoColor, getRoomIcon } from './utils/entityMapping'
import { useInactivity } from './hooks/useInactivity'
import { useTimeGradient } from './hooks/useTimeGradient'
import './components/BentoTile/BentoTile.css';
import './components/Sidebar/Sidebar.css';
import './App.css'

export type TileType = 'info' | 'toggle' | 'slider' | 'graph' | 'cover' | 'spacer' | 'media' | 'energy-gauge' | 'energy-flow';
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

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
  batteryLevelEntityId?: string;
}

const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 480) setBreakpoint('mobile');
      else if (window.innerWidth < 768) setBreakpoint('tablet');
      else setBreakpoint('desktop');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
};

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
  { id: 'salon', size: 'rect', type: 'toggle', title: 'Salon', entityId: 'light.salon', room: 'Salon', icon: 'Lightbulb', color: '#00ff88', isFavorite: true },
  { id: 'meteo', size: 'small', type: 'info', title: 'Météo', content: '18°C ☀️', room: 'Extérieur', icon: 'Sun', color: '#ffaa00', isFavorite: true },
  { id: 'security', size: 'small', type: 'info', title: 'Sécurité', content: 'Armé', room: 'Global', icon: 'ShieldCheck', color: '#ff4444', isFavorite: true },
  { id: 'conso', size: 'square', type: 'graph', title: 'Consommation', content: '450W', room: 'Global', graphData: mockGraphData, icon: 'Activity', color: '#ff00ff' },
  { id: 'cuisine', size: 'rect', type: 'toggle', title: 'Cuisine', entityId: 'light.cuisine', room: 'Cuisine', icon: 'Power', color: '#0088ff', isFavorite: true },
  { id: 'cuisine_light', size: 'rect', type: 'slider', title: 'Lumière Cuisine', entityId: 'light.cuisine', room: 'Cuisine', icon: 'Settings', color: '#ffffff' },
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
  const breakpoints: Breakpoint[] = ['desktop', 'tablet', 'mobile'];
  const colsConfig = { desktop: 12, tablet: 8, mobile: 4 };
  const result: ViewLayouts = { desktop: [], tablet: [], mobile: [] };

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
  const breakpoint = useBreakpoint();

  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'auto' | 'dark' | 'light'>('auto');
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
  const [tileToEdit, setTileToEdit] = useState<TileData | null>(null);

  // Adaptive Ambiance settings
  const [dayNightCycle, setDayNightCycle] = useState(true);
  const [weatherEffects, setWeatherEffects] = useState<WeatherEffectsMode>('all');

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
        setLayouts(savedLayouts);
        // Load Config
        try {
          const configRes = await callHAWebSocket('nexura/config/get') as {
            theme: 'auto' | 'dark' | 'light',
            screensaver_enabled?: boolean,
            day_night_cycle?: boolean,
            weather_effects?: WeatherEffectsMode,
          };
          if (configRes) {
            if (configRes.theme) setTheme(configRes.theme);
            if (configRes.screensaver_enabled !== undefined) setScreensaverEnabled(configRes.screensaver_enabled);
            if (configRes.day_night_cycle !== undefined) setDayNightCycle(configRes.day_night_cycle);
            if (configRes.weather_effects) setWeatherEffects(configRes.weather_effects);
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

  useEffect(() => {
    // Apply theme to body
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // Start dragging immediately if moved 1px (since it's a dedicated handle)
        // For mobile long-press on handle, we can keep it snappy
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = () => {
    // We handle updates in DragEnd for stability in this custom grid implementation.
    // If we want real-time "pushing", we would implement it here.
  };

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
    setTiles(prev => prev.filter(t => t.id !== id));
    setLayouts(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(view => {
        updated[view] = {
          desktop: updated[view].desktop.filter(l => l.id !== id),
          tablet: updated[view].tablet.filter(l => l.id !== id),
          mobile: updated[view].mobile.filter(l => l.id !== id),
        };
      });
      return updated;
    });
  }, []);

  const handleOpenEditModal = useCallback((tile: TileData) => {
    setTileToEdit(tile);
    setIsAddModalOpen(true);
  }, []);

  const handleAddTile = (newTile: TileData) => {
    if (tileToEdit) {
      // Update existing tile
      setTiles(prev => prev.map(t => t.id === tileToEdit.id ? { ...newTile, id: t.id } : t));
      setLayouts(prev => {
        const updated = { ...prev };
        const viewLayout = updated[activeView] || { desktop: [], tablet: [], mobile: [] };

        // Update layout entries for the specific tileToEdit.id
        const updateLayoutEntry = (layoutArr: LayoutEntry[]) => layoutArr.map(l =>
          l.id === tileToEdit.id ? { ...l, w: getSizeDimensions(newTile.size).w, h: getSizeDimensions(newTile.size).h } : l
        );

        updated[activeView] = {
          desktop: updateLayoutEntry(viewLayout.desktop),
          tablet: updateLayoutEntry(viewLayout.tablet),
          mobile: updateLayoutEntry(viewLayout.mobile),
        };

        return updated;
      });
      setTileToEdit(null);
    } else {
      // Add new tile
      setTiles(prev => [...prev, newTile]);
      const dims = getSizeDimensions(newTile.size);
      setLayouts(prev => {
        const updated = { ...prev };
        const viewLayout = updated[activeView] || { desktop: [], tablet: [], mobile: [] };
        updated[activeView] = {
          ...viewLayout,
          desktop: [...viewLayout.desktop, { id: newTile.id, x: 0, y: 0, w: dims.w, h: dims.h }],
          tablet: [...viewLayout.tablet, { id: newTile.id, x: 0, y: 0, w: Math.min(dims.w, 8), h: dims.h }],
          mobile: [...viewLayout.mobile, { id: newTile.id, x: 0, y: 0, w: Math.min(dims.w, 4), h: dims.h }],
        };

        if (newTile.isFavorite && activeView !== 'favorites') {
          const favLayout = updated.favorites || { desktop: [], tablet: [], mobile: [] };
          updated.favorites = {
            desktop: [...favLayout.desktop, { id: newTile.id, x: 0, y: 0, w: dims.w, h: dims.h }],
            tablet: [...favLayout.tablet, { id: newTile.id, x: 0, y: 0, w: Math.min(dims.w, 8), h: dims.h }],
            mobile: [...favLayout.mobile, { id: newTile.id, x: 0, y: 0, w: Math.min(dims.w, 4), h: dims.h }],
          };
        }

        return updated;
      });
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

          const maxCols = { desktop: 12, tablet: 8, mobile: 4 }[breakpoint];

          return {
            ...t,
            w: Math.min(nextDims.w, maxCols),
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

      const cols = { desktop: 12, tablet: 8, mobile: 4 }[breakpoint];

      const gridElement = document.querySelector('.bento-grid');
      const containerWidth = gridElement ? gridElement.clientWidth : window.innerWidth - 64;

      const cellWidth = containerWidth / cols;
      const cellHeight = 96; // 80px row height + 16px gap

      const dx = calculateGridOffset(delta.x, cellWidth, 0.6);
      const dy = calculateGridOffset(delta.y, cellHeight, 0.7);

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
  }, [activeView, breakpoint]);

  const handleToggle = useCallback((id: string, newState: boolean, entityId?: string) => {
    setTiles(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, isOn: newState } : t);
      const dataToSave = { layout: updated, title: dashboardTitle };
      callHAWebSocket('nexura/board/save', dataToSave).catch((e: unknown) => console.error(e));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      return updated;
    });

    if (entityId) {
      const domain = entityId.split('.')[0];
      const service = newState ? 'turn_on' : 'turn_off';
      executeService(hassConnection, domain, service, { entity_id: entityId });
    }
  }, [dashboardTitle, hassConnection, callHAWebSocket]);

  const handleSliderChange = (id: string, newValue: number, entityId?: string) => {
    setTiles(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, value: newValue } : t);
      const dataToSave = { layout: updated, title: dashboardTitle };
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
    tiles.forEach(t => {
      if (t.room && t.room.trim() !== '') {
        r.add(t.room);
      } else {
        hasRoomless = true;
      }
    });
    const sortedRooms = Array.from(r).sort();
    if (hasRoomless) {
      sortedRooms.push('Inconnue');
    }
    return sortedRooms;
  }, [tiles]);

  // Memoize to avoid recalculating on every render (drag frames)
  const currentLayoutEntries = useMemo(
    () => layouts[activeView]?.[breakpoint] || [],
    [layouts, activeView, breakpoint]
  );

  const orderedAndFilteredTiles = useMemo(() => {
    const result: (TileData & { layout: LayoutEntry })[] = [];

    for (const entry of currentLayoutEntries) {
      const tileData = tiles.find(t => t.id === entry.id);
      if (!tileData) continue;

      const combined = { ...tileData, layout: entry };

      // Filter by visibility (hide hidden tiles unless in edit mode)
      if (entry.hidden && !isEditMode) continue;

      // Filter by active view (room/favorites)
      if (activeView === 'favorites') {
        if (combined.isFavorite) result.push(combined);
      } else if (activeView === 'Inconnue') {
        if (!combined.room || combined.room.trim() === '') result.push(combined);
      } else if (combined.room === activeView) {
        result.push(combined);
      }
    }
    return result;
  }, [tiles, currentLayoutEntries, activeView, isEditMode]);

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
          const favLayout = updatedLayouts.favorites || { desktop: [], tablet: [], mobile: [] };

          updatedLayouts.favorites = {
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
  const isAnyDragging = activeId !== null;

  // Apply day/night gradient to body background
  // (must be called before any conditional returns — rules of hooks)
  useTimeGradient(dayNightCycle);

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
            maxValue={tile.maxPower || 9000}
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
      <Sidebar
        rooms={rooms}
        activeView={activeView}
        onViewChange={setActiveView}
        isEditMode={isEditMode}
        roomAlerts={roomAlerts}
        isFullScreen={isFullScreen}
        onToggleFullScreen={handleToggleFullScreen}

      />

      <div className="app-container">
        <header className="app-header">
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
                    Modifier le Dashboard
                  </button>
                ) : (
                  <div className="edit-controls">
                    <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>+ Ajouter</button>
                    <button className="btn-secondary" onClick={handleCancelEdit}>Annuler</button>
                    <button className="btn-primary" onClick={handleSaveEdit}>Enregistrer</button>
                  </div>
                )}
              </div>
            </div>
            <div className={`connection-status ${hassState}`}>
              {hassState === 'connected' ? '● Live' : (hassState === 'connecting' ? '○ Connexion...' : '✕ Erreur')}
            </div>
          </div>
        </header>

        <main>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
            autoScroll={false}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                <SortableContext
                  items={sortableItems}
                  strategy={rectSortingStrategy}
                >
                  <BentoGrid>
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
                          noPadding={tile.entityId?.startsWith('weather.') || tile.type === 'media'}
                          hideHeader={tile.entityId?.startsWith('weather.') || tile.type === 'graph' || tile.type === 'media'}
                          isAnyDragging={isAnyDragging}
                        >
                          {renderTileContent(tile)}
                        </BentoTile>
                      );
                    })}
                  </BentoGrid>
                </SortableContext>
              </motion.div>
            </AnimatePresence>

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
