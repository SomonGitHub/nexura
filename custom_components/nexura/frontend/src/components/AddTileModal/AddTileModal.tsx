import React from 'react';
import type { HassEntities } from 'home-assistant-js-websocket';
import type { TileData, TileType } from '../../App';
import type { TileSize } from '../BentoTile/BentoTile';
import './AddTileModal.css';

interface AddTileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (tile: TileData) => void;
    hassEntities: HassEntities;
    defaultRoom?: string;
    tileToEdit?: TileData;
}

export const AddTileModal: React.FC<AddTileModalProps> = ({ isOpen, onClose, onAdd, hassEntities, defaultRoom, tileToEdit }) => {
    const [title, setTitle] = React.useState('');
    const [type, setType] = React.useState<TileType>('info');
    const [size, setSize] = React.useState<TileSize>('small');
    const [entityId, setEntityId] = React.useState('');
    const [room, setRoom] = React.useState(defaultRoom || '');
    const [isScannerOpen, setIsScannerOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        if (tileToEdit && isOpen) {
            setTitle(tileToEdit.title || '');
            setType(tileToEdit.type || 'info');
            setSize(tileToEdit.size || 'small');
            setEntityId(tileToEdit.entityId || '');
            setRoom(tileToEdit.room || '');
        } else if (isOpen) {
            // Reset for new tile
            setTitle('');
            setType('info');
            setSize('small');
            setEntityId('');
            setRoom(defaultRoom || '');
        }
    }, [tileToEdit, isOpen, defaultRoom]);

    React.useEffect(() => {
        if ((type === 'cover' || type === 'slider') && size === 'small') {
            setSize('rect');
        }
        if (type === 'energy-flow' && (size === 'small' || size === 'rect' || size === 'square')) {
            setSize('large-square');
        }
    }, [type, size]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;

        // Extract current state for the selected entity if available
        const entity = entityId ? hassEntities[entityId] : null;

        const newTile: TileData = {
            id: Date.now().toString(),
            title,
            room: room || undefined,
            type,
            size,
            entityId: entityId || undefined,
            // Default contents based on type and current entity state
            isOn: type === 'toggle' ? (entity ? entity.state === 'on' : false) : undefined,
            value: type === 'slider' ? (entity?.attributes?.brightness ? Math.round((entity.attributes.brightness / 255) * 100) : 0) : undefined,
            graphData: type === 'graph' ? [] : undefined,
        };

        onAdd(newTile);
        onClose();
        // Reset form
        setTitle('');
        setType('info');
        setSize('small');
        setEntityId('');
        setRoom(defaultRoom || '');
        setIsScannerOpen(false);
        setSearchTerm('');
    };

    const handleSelectEntity = (id: string) => {
        setEntityId(id);
        const entity = hassEntities[id];
        if (entity) {
            if (!title) setTitle(entity.attributes.friendly_name || id);
            // Auto-detect type
            if (id.startsWith('cover.')) {
                setType('cover');
                setSize('rect'); // Enforce min size for covers
            } else if (id.startsWith('media_player.')) {
                setType('media');
                setSize('large-rect');
            } else if (id.startsWith('light.') || id.startsWith('switch.')) {
                setType('toggle');
            }

            // If room is empty or matches Inconnue, try to pre-fill
            if ((!room || room === 'Inconnue') && entity.attributes.area_id) {
                setRoom(entity.attributes.area_id);
            } else if (!room || room === 'Inconnue') {
                setRoom(defaultRoom || '');
            }
        }
        setIsScannerOpen(false);
    };

    const filteredEntities = Object.keys(hassEntities).filter(id => {
        const entity = hassEntities[id];
        const friendlyName = (entity.attributes.friendly_name || '').toLowerCase();
        const searchLower = searchTerm.toLowerCase();

        // Match ID or Friendly Name
        return id.toLowerCase().includes(searchLower) || friendlyName.includes(searchLower);
    }).slice(0, 50); // Increased limit to 50 for better usability without too much lag

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{tileToEdit ? 'Modifier la Tuile' : 'Ajouter une Tuile'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group entity-scanner-group">
                        <label>ID de l'entité Home Assistant (optionnel)</label>
                        <div className="input-with-action">
                            <input
                                type="text"
                                value={entityId}
                                onChange={(e) => setEntityId(e.target.value)}
                                placeholder="Ex: light.salon"
                            />
                            <button
                                type="button"
                                className="btn-icon"
                                onClick={() => setIsScannerOpen(!isScannerOpen)}
                                title="Scanner les entités"
                            >
                                🔍
                            </button>
                        </div>

                        {isScannerOpen && (
                            <div className="entity-scanner-dropdown">
                                <input
                                    type="text"
                                    className="scanner-search"
                                    placeholder="Rechercher une entité..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                                <div className="entity-list">
                                    {filteredEntities.map(id => (
                                        <div
                                            key={id}
                                            className="entity-item"
                                            onClick={() => handleSelectEntity(id)}
                                        >
                                            <span className="entity-name">{hassEntities[id].attributes.friendly_name || id}</span>
                                            <span className="entity-id">{id}</span>
                                        </div>
                                    ))}
                                    {filteredEntities.length === 0 && <div className="no-result">Aucune entité trouvée</div>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Titre de la tuile</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Lumière Salon"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Pièce (optionnel)</label>
                        <input
                            type="text"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            placeholder="Ex: Salon, Cuisine..."
                        />
                    </div>

                    <div className="form-group">
                        <label>Type de composant</label>
                        <select value={type} onChange={(e) => setType(e.target.value as TileType)}>
                            <option value="info">Texte simple (Info)</option>
                            <option value="toggle">Interrupteur (Toggle)</option>
                            <option value="slider">Curseur (Slider)</option>
                            <option value="graph">Graphique Miniature (Graph)</option>
                            <option value="cover">Volet (Cover)</option>
                            <option value="media">Lecteur Média (Media)</option>
                            <option value="energy-gauge">Jauge Énergie (Gauge)</option>
                            <option value="energy-flow">Flux Énergie (Flow)</option>
                            <option value="spacer">Espace (Spacer)</option>
                        </select>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
                        <div className="modal-actions-right">
                            <button type="submit" className="btn-primary">{tileToEdit ? 'Enregistrer' : 'Ajouter'}</button>
                            <a href="https://www.buymeacoffee.com/simonv" target="_blank" rel="noreferrer" className="bmc-button">
                                <img
                                    src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                                    alt="Buy Me A Coffee"
                                    style={{ height: '36px', width: '130px' }}
                                />
                            </a>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
