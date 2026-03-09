/**
 * Utility functions to map Home Assistant entities to visuals
 * based on their domain and device_class.
 */

/**
 * Maps Home Assistant weather states to Lucide icons
 */
export const getWeatherIcon = (state: string): string => {
    switch (state) {
        case 'sunny': return 'Sun';
        case 'clear-night': return 'Moon';
        case 'cloudy': return 'Cloud';
        case 'fog': return 'CloudFog';
        case 'hail': return 'CloudHail';
        case 'lightning': return 'CloudLightning';
        case 'lightning-rainy': return 'CloudLightning';
        case 'partlycloudy': return 'CloudSun';
        case 'pouring': return 'CloudRain';
        case 'rainy': return 'CloudRain';
        case 'snowy': return 'Snowflake';
        case 'snowy-rainy': return 'CloudRainWind';
        case 'windy': return 'Wind';
        case 'windy-variant': return 'Wind';
        case 'exceptional': return 'AlertCircle';
        default: return 'Cloud';
    }
};

/**
 * Maps entity device_class and state to auto-selected icon
 */
export const getAutoIcon = (entityId?: string, state?: string, deviceClass?: string, unit?: string): string => {
    const domain = entityId?.split('.')[0];
    const isOpen = state === 'on' || state === 'open' || state === 'tripped';

    // Domain based defaults
    if (domain === 'light') return 'Lightbulb';
    if (domain === 'switch') return 'Power';
    if (domain === 'climate') return 'Thermometer';
    if (domain === 'media_player') return 'Play';
    if (domain === 'vacuum') return 'Wind';
    if (domain === 'weather') return getWeatherIcon(state || 'cloudy');
    if (domain === 'cover') return 'Blinds';
    if (domain === 'scene') return 'Zap';

    // Device class based overrides
    if (deviceClass === 'temperature') return 'Thermometer';
    if (deviceClass === 'humidity') return 'Droplet';
    if (deviceClass === 'battery') return 'Battery';
    if (deviceClass === 'window') return 'Grid2X2';
    if (deviceClass === 'door') return isOpen ? 'DoorOpen' : 'DoorClosed';
    if (deviceClass === 'garage_door') return isOpen ? 'DoorOpen' : 'DoorClosed';
    if (deviceClass === 'motion') return 'Activity';
    if (deviceClass === 'smoke') return 'Flame';
    if (deviceClass === 'power' || deviceClass === 'energy' || unit === 'W' || unit === 'kW') return 'Zap';
    if (unit) return 'TrendingUp';

    return 'HelpCircle';
};

/**
 * Maps entity device_class and state to auto-selected color
 */
export const getAutoColor = (entityId?: string, state?: string, deviceClass?: string): string => {
    const domain = entityId?.split('.')[0];
    const isOn = state === 'on' || state === 'open' || state === 'tripped' || (state && !['off', 'unavailable', 'unknown'].includes(state));

    if (!isOn) return 'var(--icon-inactive)';

    if (domain === 'light') return '#ffaa00';
    if (domain === 'climate') return '#ff4444';
    if (domain === 'weather') return '#0ea5e9';
    if (domain === 'cover') return '#38bdf8';

    if (deviceClass === 'temperature') return '#ffaa00';
    if (deviceClass === 'humidity') return '#0088ff';
    if (deviceClass === 'moisture' || deviceClass === 'smoke' || deviceClass === 'gas') return '#ff4444';

    return '#00ff88';
};

/**
 * Maps room names to Lucide icons based on keywords
 */
export const getRoomIcon = (roomName: string): string => {
    const name = roomName.toLowerCase();

    if (name.includes('salon') || name.includes('séjour') || name.includes('living')) return 'Sofa';
    if (name.includes('cuisine') || name.includes('repas') || name.includes('manger')) return 'Utensils';
    if (name.includes('chambre')) return 'Bed';
    if (name.includes('bain') || name.includes('sdb') || name.includes('douche')) return 'Bath';
    if (name.includes('toilette') || name.includes('wc')) return 'Info';
    if (name.includes('garage')) return 'Car';
    if (name.includes('entrée') || name.includes('couloir') || name.includes('hall') || name.includes('dégagement')) return 'DoorOpen';
    if (name.includes('extérieur') || name.includes('jardin') || name.includes('terrasse') || name.includes('balcon')) return 'Trees';
    if (name.includes('bureau') || name.includes('work') || name.includes('office')) return 'Briefcase';
    if (name.includes('buanderie') || name.includes('laverie')) return 'WashingMachine';
    if (name.includes('dressing')) return 'Shirt';
    if (name.includes('sport') || name.includes('gym')) return 'Dumbbell';
    if (name.includes('cave') || name.includes('cellier') || name.includes('stockage')) return 'Box';
    if (name.includes('favori')) return 'Star';

    return 'Home';
};
