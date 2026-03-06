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
  type DragOverEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { useState, useEffect, useMemo } from 'react'
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
import { getHaloType } from './hooks/useTileStatus'
import { getAutoIcon, getAutoColor, getRoomIcon } from './utils/entityMapping'
import { useInactivity } from './hooks/useInactivity'
import './components/BentoTile/BentoTile.css';
import './components/Sidebar/Sidebar.css';
import './App.css'

export type TileType = 'info' | 'toggle' | 'slider' | 'graph' | 'cover' | 'spacer';
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface LayoutEntry {
  id: string;
  size: TileSize;
  hidden?: boolean;
}

export type LayoutsData = Record<Breakpoint, LayoutEntry[]>;

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

const STORAGE_KEY = 'nexura_dashboard_tiles_v2';

function App() {
  const { t } = useTranslation()

  const [tiles, setTiles] = useState<TileData[]>([]);
  const [layouts, setLayouts] = useState<LayoutsData>({ desktop: [], tablet: [], mobile: [] });
  const breakpoint = useBreakpoint();

  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'auto' | 'dark' | 'light'>('auto');

  const [isEditMode, setIsEditMode] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState('');
  const [backupTiles, setBackupTiles] = useState<TileData[]>([]);
  const [backupLayouts, setBackupLayouts] = useState<LayoutsData>({ desktop: [], tablet: [], mobile: [] });
  const [backupTitle, setBackupTitle] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isInactive = useInactivity(120000); // 2 minutes induction period for ScreenSaver
  const [activeView, setActiveView] = useState('favorites');
  const [tileToEdit, setTileToEdit] = useState<TileData | null>(null);

  // Hass states
  const [hassEntities, setHassEntities] = useState<HassEntities>({});
  const [hassConnection, setHassConnection] = useState<Connection | null>(null);
  const [hassState, setHassState] = useState<HassConnectionState>('connecting');
  const [liveHistory, setLiveHistory] = useState<Record<string, { time: string; value: number }[]>>({});

  // Unified WebSocket Caller
  const callHAWebSocket = async (type: string, payload?: Record<string, unknown>): Promise<unknown> => {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ layout: payload?.layout, title: payload?.title }));
      return { success: true };
    }
    throw new Error("Unknown command");
  };

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
        const data = await callHAWebSocket('nexura/board/get') as { layout: TileData[], layouts?: LayoutsData, title?: string };
        let layout: TileData[] = [];
        let savedLayouts: LayoutsData = { desktop: [], tablet: [], mobile: [] };
        let title = '';

        if (data && typeof data === 'object') {
          layout = data.layout || [];
          savedLayouts = data.layouts || { desktop: [], tablet: [], mobile: [] };
          title = data.title || '';
        }

        setDashboardTitle(title);

        const finalTiles = (Array.isArray(layout) && layout.length > 0) ? layout : INITIAL_TILES;

        // Compute combined layouts if missing
        if (!savedLayouts.desktop || savedLayouts.desktop.length === 0) {
          const defaultLayout: LayoutEntry[] = finalTiles.map(t => ({ id: t.id, size: t.size || 'small' }));
          savedLayouts = {
            desktop: [...defaultLayout],
            tablet: [...defaultLayout],
            mobile: [...defaultLayout]
          };
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
        // Load Config Theme
        try {
          const configRes = await callHAWebSocket('nexura/config/get') as { theme: 'auto' | 'dark' | 'light' };
          if (configRes && configRes.theme) {
            setTheme(configRes.theme);
          }
        } catch (e) {
          console.warn("Could not load theme config", e);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      setLayouts((prev) => {
        const currentLayout = prev[breakpoint] || [];
        const oldIndex = currentLayout.findIndex((t) => t.id === active.id);
        const newIndex = currentLayout.findIndex((t) => t.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return prev;

        const newLayout = arrayMove(currentLayout, oldIndex, newIndex);
        return { ...prev, [breakpoint]: newLayout };
      });
    }
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

  const handleDeleteTile = (id: string) => {
    setTiles(prev => prev.filter(t => t.id !== id));
  };

  const handleOpenEditModal = (tile: TileData) => {
    setTileToEdit(tile);
    setIsAddModalOpen(true);
  };

  const handleAddTile = (newTile: TileData) => {
    if (tileToEdit) {
      // Update existing tile
      setTiles(prev => prev.map(t => t.id === tileToEdit.id ? { ...newTile, id: t.id } : t));
      setTileToEdit(null);
    } else {
      // Add new tile
      setTiles(prev => [...prev, newTile]);
      setLayouts(prev => ({
        desktop: [...prev.desktop, { id: newTile.id, size: newTile.size || 'small' }],
        tablet: [...prev.tablet, { id: newTile.id, size: newTile.size || 'small' }],
        mobile: [...prev.mobile, { id: newTile.id, size: newTile.size || 'small' }],
      }));
    }
    setIsAddModalOpen(false);
  };

  const handleResizeTile = (id: string) => {
    setLayouts(prev => {
      const currentLayout = prev[breakpoint] || [];
      const updatedLayout = currentLayout.map(t => {
        if (t.id === id) {
          const tileInfo = tiles.find(ti => ti.id === id);
          let sizes: TileSize[] = ['small', 'rect', 'square', 'large-rect', 'large-square'];

          if (tileInfo?.type === 'cover' || tileInfo?.type === 'slider') {
            sizes = sizes.filter(s => s !== 'small');
          }

          const currentIndex = sizes.indexOf(t.size);
          const nextSize = sizes[(currentIndex + 1) % sizes.length];
          return { ...t, size: nextSize };
        }
        return t;
      });
      return { ...prev, [breakpoint]: updatedLayout };
    });
  };

  const handleDragEnd = () => {
    const currentTiles = [...tiles];
    const dataToSave = { layout: currentTiles, title: dashboardTitle };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));

    if (!isEditMode) {
      callHAWebSocket('nexura/board/save', dataToSave)
        .catch((err: unknown) => console.error("Failed to save to HA", err));
    }
    setActiveId(null);
  };

  const handleToggle = (id: string, newState: boolean, entityId?: string) => {
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
  };

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

  const currentLayoutEntries = layouts[breakpoint] || [];

  const orderedAndFilteredTiles = useMemo(() => {
    const result: (TileData & { size: TileSize; hidden?: boolean })[] = [];

    for (const entry of currentLayoutEntries) {
      const tileData = tiles.find(t => t.id === entry.id);
      if (!tileData) continue;

      const combined = { ...tileData, size: entry.size, hidden: entry.hidden };

      // Filter by visibility (hide hidden tiles unless in edit mode)
      if (combined.hidden && !isEditMode) continue;

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

  const handleToggleFavorite = (id: string) => {
    setTiles(prev => prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
  };

  const sortableItems = useMemo(() => orderedAndFilteredTiles.map(t => t.id), [orderedAndFilteredTiles]);

  const activeTile = activeId ? orderedAndFilteredTiles.find(t => t.id === activeId) : null;

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

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
      case 'cover':
        return <CoverContent
          entity={entity}
          onAction={(action) => handleCoverAction(action, tile.entityId)}
          size={tile.size}
        />;
    }
  };

  return (
    <div className={`app-layout ${isFullScreen ? 'is-fullscreen' : ''}`} >
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
                          size={tile.size}
                          title={tile.title}
                          type={tile.type}
                          icon={resolvedIcon}
                          color={resolvedColor}
                          entityId={tile.entityId}
                          hassEntities={hassEntities}
                          isEditMode={isEditMode}
                          isFavorite={tile.isFavorite}
                          className={tile.hidden ? 'tile-hidden' : ''}
                          onDelete={() => handleDeleteTile(tile.id)}
                          onResize={() => handleResizeTile(tile.id)}
                          onEdit={() => handleOpenEditModal(tile)}
                          onToggleFavorite={() => handleToggleFavorite(tile.id)}
                          noPadding={tile.entityId?.startsWith('weather.')}
                          hideHeader={tile.entityId?.startsWith('weather.') || tile.type === 'graph'}
                        >
                          {renderTileContent(tile)}
                        </BentoTile>
                      );
                    })}
                  </BentoGrid>
                </SortableContext>
              </motion.div>
            </AnimatePresence>

            <DragOverlay dropAnimation={dropAnimation} adjustScale={false}>
              {activeTile ? (
                <BentoTile
                  id={activeTile.id}
                  size={activeTile.size}
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

      {isInactive && !isEditMode && <ScreenSaver entities={hassEntities} />}
    </div >
  )
}

export default App
