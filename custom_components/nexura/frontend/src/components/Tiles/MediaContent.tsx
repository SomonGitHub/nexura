import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Power } from 'lucide-react';
import './MediaContent.css';

interface MediaContentProps {
    entity: any;
    onAction: (action: 'play' | 'pause' | 'previous' | 'next' | 'power') => void;
}

export const MediaContent: React.FC<MediaContentProps> = ({ entity, onAction }) => {
    if (!entity) return null;

    const { state, attributes } = entity;
    const isPlaying = state === 'playing';
    const title = attributes.media_title || 'Média';
    const artist = attributes.media_artist || attributes.friendly_name || 'Inconnu';
    const artwork = attributes.entity_picture;

    return (
        <div className="media-content">
            {artwork && (
                <div
                    className="media-artwork-bg"
                    style={{ backgroundImage: `url(${artwork})` }}
                />
            )}
            <div className="media-overlay" />

            <div className="media-info">
                <div className="media-text">
                    <div className="media-title">{title}</div>
                    <div className="media-artist">{artist}</div>
                </div>
            </div>

            <div className="media-controls">
                <button
                    className="media-btn"
                    onClick={(e) => { e.stopPropagation(); onAction('previous'); }}
                    title="Précédent"
                >
                    <SkipBack size={20} />
                </button>

                <button
                    className="media-btn play-btn"
                    onClick={(e) => { e.stopPropagation(); onAction(isPlaying ? 'pause' : 'play'); }}
                    title={isPlaying ? 'Pause' : 'Lecture'}
                >
                    {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
                </button>

                <button
                    className="media-btn"
                    onClick={(e) => { e.stopPropagation(); onAction('next'); }}
                    title="Suivant"
                >
                    <SkipForward size={20} />
                </button>

                <button
                    className="media-btn power-btn"
                    onClick={(e) => { e.stopPropagation(); onAction('power'); }}
                    title="Éteindre"
                >
                    <Power size={18} />
                </button>
            </div>

            {attributes.media_duration && attributes.media_position !== undefined && (
                <div className="media-progress-container">
                    <div
                        className="media-progress-bar"
                        style={{ width: `${(attributes.media_position / attributes.media_duration) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
};
