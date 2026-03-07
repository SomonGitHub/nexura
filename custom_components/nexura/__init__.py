"""The Nexura integration."""
import logging
import os
import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import websocket_api, frontend
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.helpers.storage import Store

from .const import (
    DOMAIN,
    STORAGE_KEY,
    STORAGE_VERSION,
    CONF_DAY_NIGHT_CYCLE,
    CONF_WEATHER_EFFECTS,
    WEATHER_EFFECTS_ALL,
)

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Nexura from a config entry."""
    
    # Register WebSocket commands
    websocket_api.async_register_command(hass, ws_get_board)
    websocket_api.async_register_command(hass, ws_save_board)
    websocket_api.async_register_command(hass, ws_get_config)

    # Register Static View for Frontend
    # This path will serve the compiled React app
    frontend_path = os.path.join(os.path.dirname(__file__), "frontend/dist")
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/nexura_static", frontend_path, False)]
    )

    # Register Side Panel
    try:
        frontend.async_register_built_in_panel(
            hass,
            component_name="iframe",
            sidebar_title="Nexura",
            sidebar_icon="mdi:home-assistant",
            frontend_url_path="nexura",
            config={
                "url": "/nexura_static/index.html"
            },
            require_admin=False
        )
    except ValueError:
        # Panel already registered, ignore
        pass

    entry.async_on_unload(entry.add_update_listener(update_listener))

    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle options update."""
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    return True

@websocket_api.websocket_command({"type": "nexura/board/get"})
@websocket_api.async_response
async def ws_get_board(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict):
    """Handle get board layout command."""
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load()
    
    # Structure par défaut
    default_data = {"layout": [], "layouts": {}, "title": ""}
    
    if data is None:
        connection.send_result(msg["id"], default_data)
        return

    # Migration de l'ancienne liste vers le nouveau format dict
    if isinstance(data, list):
        connection.send_result(msg["id"], {"layout": data, "layouts": {}, "title": ""})
    else:
        # S'assurer que les clés minimales existent
        res = {
            "layout": data.get("layout", []),
            "layouts": data.get("layouts", {}),
            "title": data.get("title", "")
        }
        connection.send_result(msg["id"], res)


@websocket_api.websocket_command({
    "type": "nexura/board/save",
    vol.Required("layout"): list,
    vol.Optional("layouts"): dict,
    vol.Optional("title"): str
})
@websocket_api.async_response
async def ws_save_board(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict):
    """Handle save board layout command."""
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    await store.async_save({
        "layout": msg["layout"],
        "layouts": msg.get("layouts", {}),
        "title": msg.get("title", "")
    })
    connection.send_result(msg["id"])

@websocket_api.websocket_command({"type": "nexura/config/get"})
@websocket_api.async_response
async def ws_get_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict):
    """Handle get config command."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if entries:
        entry = entries[0]
        theme = entry.options.get("theme", "auto")
        screensaver_enabled = entry.options.get("screensaver_enabled", True)
        day_night_cycle = entry.options.get(CONF_DAY_NIGHT_CYCLE, True)
        weather_effects = entry.options.get(
            CONF_WEATHER_EFFECTS, WEATHER_EFFECTS_ALL
        )
        connection.send_result(msg["id"], {
            "theme": theme,
            "screensaver_enabled": screensaver_enabled,
            "day_night_cycle": day_night_cycle,
            "weather_effects": weather_effects,
        })
    else:
        connection.send_result(msg["id"], {
            "theme": "auto",
            "screensaver_enabled": True,
            "day_night_cycle": True,
            "weather_effects": WEATHER_EFFECTS_ALL,
        })

