"""Native EduPage school-board panel for the Home Assistant sidebar."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.helpers import entity_registry as er

from .const import CONF_STUDENT_NAME, CONF_SUBDOMAIN, DOMAIN

PANEL_URL = "edupage-school"
PANEL_JS = "/homeassistantedupage/edupage-school-board-panel.js"
PANEL_JS_VERSION = "2026.10.2"
_PANEL_DATA_KEY = "homeassistantedupage_school_board_panel"

_PANEL_DATA_SCHEMA = {
    vol.Required("type"): "homeassistantedupage/panel",
}

_ENTITY_PREFIXES = {
    "timetable": "edupage_calendar_",
    "assignments": "edupage_assignments_",
    "todo": "edupage_homework_",
    "notifications": "edupage_notification_",
    "events": "edupage_events_",
    "open_homework": "edupage_open_homework_",
    "overdue_homework": "edupage_overdue_homework_",
    "next_homework_deadline": "edupage_next_homework_deadline_",
    "upcoming_exams": "edupage_upcoming_exams_",
    "timetable_changes": "edupage_timetable_changes_",
    "missing_teachers": "edupage_missing_teachers_",
    "next_ringing": "edupage_next_ringing_",
    "term_first": "edupage_term_first_",
    "term_second": "edupage_term_second_",
}


def _school_domain(value: Any) -> str:
    """Format a configured EduPage host for display without making an URL."""

    host = str(value or "").strip()
    if not host:
        return ""
    if "://" in host:
        host = urlsplit(host).netloc or urlsplit(host).path
    host = host.strip("/ ").lower()
    if host and "." not in host:
        host = f"{host}.edupage.org"
    return host


def _student_entities(hass: Any, entry_id: str) -> dict[str, Any]:
    """Resolve current entity IDs from the registry, including user renames."""

    registry = er.async_get(hass)
    entities: dict[str, Any] = {key: None for key in _ENTITY_PREFIXES}
    entities["subjects"] = []

    for entity in er.async_entries_for_config_entry(registry, entry_id):
        if entity.platform != DOMAIN:
            continue
        for key, prefix in _ENTITY_PREFIXES.items():
            if entity.unique_id.startswith(prefix):
                entities[key] = entity.entity_id
                break
        else:
            if entity.unique_id.startswith("edupage_subject_"):
                name = entity.original_name or entity.name or entity.entity_id
                if name.startswith("[") and "] " in name:
                    name = name.split("] ", 1)[1]
                entities["subjects"].append(
                    {"entity_id": entity.entity_id, "name": name}
                )

    entities["subjects"].sort(key=lambda item: item["name"].casefold())
    return entities


def serialize_students(hass: Any) -> list[dict[str, Any]]:
    """Return only the display data needed by the authenticated sidebar UI."""

    coordinators = hass.data.get(DOMAIN, {})
    students = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        coordinator = coordinators.get(entry.entry_id)
        data = getattr(coordinator, "data", None) if coordinator else None
        if not data:
            continue

        student = data.get("student") or {}
        name = (
            student.get("name")
            or entry.data.get(CONF_STUDENT_NAME)
            or entry.title
        )
        students.append(
            {
                "key": entry.entry_id,
                "name": str(name),
                "class_names": [
                    str(value)
                    for value in student.get("class_names", [])
                    if value
                ],
                "school_domain": _school_domain(
                    entry.data.get(CONF_SUBDOMAIN)
                ),
                "entities": _student_entities(hass, entry.entry_id),
            }
        )
    return students


@websocket_api.websocket_command(_PANEL_DATA_SCHEMA)
@websocket_api.async_response
async def websocket_get_panel_data(hass, connection, msg) -> None:
    """Return current student/entity mappings to an authenticated HA client."""

    connection.send_result(msg["id"], {"students": serialize_students(hass)})


def _register_websocket(hass: Any) -> None:
    """Register the read-only panel data command once per HA process."""

    data = hass.data.setdefault(_PANEL_DATA_KEY, {})
    if data.get("websocket"):
        return
    websocket_api.async_register_command(hass, websocket_get_panel_data)
    data["websocket"] = True


async def async_setup_panel(hass: Any) -> None:
    """Register frontend assets and the sidebar item once an entry is loaded."""

    if not getattr(hass, "http", None):
        return
    data = hass.data.setdefault(_PANEL_DATA_KEY, {})
    lock = data.setdefault("lock", asyncio.Lock())
    async with lock:
        if data.get("registered"):
            return

        _register_websocket(hass)
        if not data.get("static_registered"):
            static_path = (
                Path(__file__).parent / "www" / "edupage-school-board-panel.js"
            )
            if hasattr(hass.http, "async_register_static_paths"):
                from homeassistant.components.http import StaticPathConfig

                await hass.http.async_register_static_paths(
                    [
                        StaticPathConfig(
                            PANEL_JS,
                            str(static_path),
                            cache_headers=False,
                        )
                    ]
                )
            else:  # Compatibility with older HA versions used by the test environment.
                hass.http.register_static_path(
                    PANEL_JS, str(static_path), cache_headers=False
                )
            # HTTP routes live for the HA process lifetime, even when the final
            # config entry unloads. Preserve this marker across panel reloads.
            data["static_registered"] = True

        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title="EduPage",
            sidebar_icon="mdi:school",
            frontend_url_path=PANEL_URL,
            config={
                "_panel_custom": {
                    "name": "edupage-school-board-panel",
                    "js_url": f"{PANEL_JS}?v={PANEL_JS_VERSION}",
                    "embed_iframe": False,
                    "trust_external": False,
                }
            },
            require_admin=False,
            update=True,
        )
        data["registered"] = True


def async_unsetup_panel(hass: Any) -> None:
    """Remove the sidebar panel after the last EduPage entry unloads."""

    data = hass.data.get(_PANEL_DATA_KEY)
    if not data or not data.pop("registered", False):
        return
    frontend.async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)
