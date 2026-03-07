"""Config flow for Nexura integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import selector

from .const import (
    DOMAIN,
    CONF_THEME,
    THEME_AUTO,
    THEMES,
    CONF_SCREENSAVER,
    CONF_DAY_NIGHT_CYCLE,
    CONF_WEATHER_EFFECTS,
    WEATHER_EFFECTS_ALL,
    WEATHER_EFFECTS_OPTIONS,
)

_LOGGER = logging.getLogger(__name__)


class NexuraOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle Nexura options."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        # Get current values from options, with sensible defaults
        current_theme = THEME_AUTO
        if hasattr(self, "config_entry") and self.config_entry:
            current_theme = self.config_entry.options.get(CONF_THEME, THEME_AUTO)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_THEME,
                        default=current_theme,
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=THEMES,
                            mode=selector.SelectSelectorMode.DROPDOWN,
                            translation_key=CONF_THEME,
                        )
                    ),
                    vol.Optional(
                        CONF_SCREENSAVER,
                        default=self.config_entry.options.get(
                            CONF_SCREENSAVER, True
                        ),
                    ): selector.BooleanSelector(),
                    vol.Optional(
                        CONF_DAY_NIGHT_CYCLE,
                        default=self.config_entry.options.get(
                            CONF_DAY_NIGHT_CYCLE, True
                        ),
                    ): selector.BooleanSelector(),
                    vol.Optional(
                        CONF_WEATHER_EFFECTS,
                        default=self.config_entry.options.get(
                            CONF_WEATHER_EFFECTS, WEATHER_EFFECTS_ALL
                        ),
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=WEATHER_EFFECTS_OPTIONS,
                            mode=selector.SelectSelectorMode.DROPDOWN,
                            translation_key=CONF_WEATHER_EFFECTS,
                        )
                    ),
                }
            ),
        )

class NexuraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Nexura."""

    VERSION = 1

    @callback
    def async_get_options_flow(self) -> NexuraOptionsFlowHandler:
        """Create the options flow."""
        return NexuraOptionsFlowHandler()

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")

        if user_input is not None:
            return self.async_create_entry(title="Nexura", data={})

        return self.async_show_form(step_id="user")
