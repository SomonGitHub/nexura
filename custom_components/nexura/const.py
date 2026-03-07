"""Constants for the Nexura integration."""

DOMAIN = "nexura"
STORAGE_KEY = f"{DOMAIN}.board_layout"
STORAGE_VERSION = 1

CONF_THEME = "theme"
CONF_SCREENSAVER = "screensaver_enabled"

THEME_AUTO = "auto"
THEME_DARK = "dark"
THEME_LIGHT = "light"

THEMES = [THEME_AUTO, THEME_DARK, THEME_LIGHT]

# Adaptive Ambiance settings
CONF_DAY_NIGHT_CYCLE = "day_night_cycle"
CONF_WEATHER_EFFECTS = "weather_effects"

WEATHER_EFFECTS_OFF = "off"
WEATHER_EFFECTS_SUN_ONLY = "sun_only"
WEATHER_EFFECTS_ALL = "all"
WEATHER_EFFECTS_OPTIONS = [
    WEATHER_EFFECTS_OFF,
    WEATHER_EFFECTS_SUN_ONLY,
    WEATHER_EFFECTS_ALL,
]
