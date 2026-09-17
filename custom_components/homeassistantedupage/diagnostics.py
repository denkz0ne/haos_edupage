"""Diagnostics support for the EduPage integration."""

from __future__ import annotations

from collections import Counter
from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_USERNAME
from homeassistant.core import HomeAssistant

from .const import (
    CONF_PHPSESSID,
    CONF_STUDENT_ID,
    CONF_STUDENT_NAME,
    CONF_SUBDOMAIN,
    CONF_SUBJECT_IDS,
    DOMAIN,
)

# Diagnostics must be safe to attach to a public issue. Keep account, school,
# session and student identifiers out of the exported file.
_TO_REDACT = {
    CONF_USERNAME,
    CONF_PHPSESSID,
    CONF_SUBDOMAIN,
    CONF_STUDENT_ID,
    CONF_STUDENT_NAME,
    "password",
}


def _safe_len(value: Any) -> int:
    """Return len(value), or zero for missing/non-sized values."""
    if value is None:
        return 0
    try:
        return len(value)
    except TypeError:
        return 0


def _event_type_name(event: Any) -> str:
    """Return a stable string representation of an EduPage event type."""
    event_type = getattr(event, "event_type", None)
    value = getattr(event_type, "value", None)
    if value is not None:
        return str(value)
    return str(event_type)


def _count_nested_items(mapping: Any) -> int:
    """Count list-like values stored in a date/term mapping."""
    if not isinstance(mapping, dict):
        return 0
    return sum(_safe_len(items) for items in mapping.values())


def _build_capability_summary(data: dict[str, Any] | None) -> dict[str, Any]:
    """Build a JSON-safe, privacy-preserving summary of coordinator data."""
    data = data or {}

    notifications = data.get("notifications") or []
    notification_types = Counter(_event_type_name(event) for event in notifications)

    timetable = data.get("timetable") or {}
    cancelled_lessons = data.get("cancelled_lessons") or {}
    canteen_menu = data.get("canteen_menu") or {}
    grades_per_term = data.get("grades_per_term") or {}
    student = data.get("student") or {}

    return {
        "available_data_keys": sorted(data),
        "data_ok": {
            str(key): bool(value)
            for key, value in (data.get("data_ok") or {}).items()
        },
        "student": {
            "available": bool(student),
            "class_id_available": student.get("class_id") is not None,
            "class_names_available": bool(student.get("class_names")),
        },
        "grades": {
            "count": _safe_len(data.get("grades")),
            "school_year_available": data.get("school_year") is not None,
            "per_term_count": {
                str(term): _safe_len(items)
                for term, items in grades_per_term.items()
            },
        },
        "subjects": {
            "count": _safe_len(data.get("subjects")),
        },
        "notifications": {
            "count": _safe_len(notifications),
            "types": dict(sorted(notification_types.items())),
        },
        "timetable": {
            "days_with_lessons": _safe_len(timetable),
            "lesson_count": _count_nested_items(timetable),
            "days_with_cancelled_lessons": _safe_len(cancelled_lessons),
            "cancelled_lesson_count": _count_nested_items(cancelled_lessons),
        },
        "canteen": {
            "days_with_menu": _safe_len(canteen_menu),
            "meal_count": _count_nested_items(canteen_menu),
        },
        "substitution": {
            "timetable_change_count": _safe_len(data.get("timetable_changes")),
            "missing_teacher_count": _safe_len(data.get("missing_teachers")),
        },
        "ringing": {
            "next_ringing_available": data.get("next_ringing") is not None,
        },
        "last_updated": data.get("last_updated"),
    }


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for an EduPage config entry."""
    coordinator = hass.data.get(DOMAIN, {}).get(entry.entry_id)

    selected_subjects = entry.options.get(CONF_SUBJECT_IDS)
    options_summary = {
        "subject_selection_configured": selected_subjects is not None,
        "selected_subject_count": _safe_len(selected_subjects),
    }

    if coordinator is None:
        return {
            "config_entry": async_redact_data(dict(entry.data), _TO_REDACT),
            "options": options_summary,
            "runtime": {
                "loaded": False,
            },
        }

    update_interval = getattr(coordinator, "update_interval", None)
    update_interval_seconds = (
        update_interval.total_seconds()
        if update_interval is not None
        else None
    )

    return {
        "config_entry": async_redact_data(dict(entry.data), _TO_REDACT),
        "options": options_summary,
        "runtime": {
            "loaded": True,
            "last_update_success": bool(
                getattr(coordinator, "last_update_success", False)
            ),
            "update_interval_seconds": update_interval_seconds,
        },
        "capabilities": _build_capability_summary(
            getattr(coordinator, "data", None)
        ),
    }
