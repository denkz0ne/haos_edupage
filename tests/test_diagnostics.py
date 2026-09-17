"""Tests for EduPage diagnostics."""

from datetime import timedelta
from types import SimpleNamespace

import pytest

from custom_components.homeassistantedupage.const import (
    CONF_PHPSESSID,
    CONF_STUDENT_ID,
    CONF_STUDENT_NAME,
    CONF_SUBDOMAIN,
    CONF_SUBJECT_IDS,
    DOMAIN,
)
from custom_components.homeassistantedupage.diagnostics import (
    _build_capability_summary,
    async_get_config_entry_diagnostics,
)
from homeassistant.const import CONF_USERNAME


def _event(event_type):
    return SimpleNamespace(event_type=SimpleNamespace(value=event_type))


def test_build_capability_summary_counts_available_features():
    data = {
        "student": {
            "id": "student-123",
            "name": "Private Student",
            "class_id": "class-1",
            "class_names": ["1.A"],
        },
        "grades": [object(), object(), object()],
        "subjects": [object(), object()],
        "notifications": [_event("homework"), _event("homework"), _event("grade")],
        "timetable": {"2026-09-17": [object(), object()]},
        "cancelled_lessons": {"2026-09-18": [object()]},
        "canteen_menu": {"2026-09-17": [object(), object()]},
        "timetable_changes": [object()],
        "missing_teachers": [object(), object()],
        "next_ringing": object(),
        "school_year": object(),
        "grades_per_term": {"first": [object(), object()], "second": [object()]},
        "data_ok": {"grades": True, "notifications": False},
        "last_updated": "2026-09-17T07:53:00",
    }

    summary = _build_capability_summary(data)

    assert summary["student"] == {
        "available": True,
        "class_id_available": True,
        "class_names_available": True,
    }
    assert summary["grades"]["count"] == 3
    assert summary["grades"]["per_term_count"] == {"first": 2, "second": 1}
    assert summary["subjects"]["count"] == 2
    assert summary["notifications"]["types"] == {"grade": 1, "homework": 2}
    assert summary["timetable"]["lesson_count"] == 2
    assert summary["timetable"]["cancelled_lesson_count"] == 1
    assert summary["canteen"]["meal_count"] == 2
    assert summary["substitution"]["timetable_change_count"] == 1
    assert summary["substitution"]["missing_teacher_count"] == 2
    assert summary["ringing"]["next_ringing_available"] is True

    # The capability summary deliberately exposes presence/counts, not identity.
    assert "Private Student" not in str(summary)
    assert "student-123" not in str(summary)


@pytest.mark.asyncio
async def test_config_entry_diagnostics_redacts_account_and_student_data():
    coordinator = SimpleNamespace(
        data={
            "student": {"id": "student-123", "name": "Private Student"},
            "notifications": [_event("message")],
            "data_ok": {"notifications": True},
        },
        last_update_success=True,
        update_interval=timedelta(minutes=30),
    )
    hass = SimpleNamespace(data={DOMAIN: {"entry-1": coordinator}})
    entry = SimpleNamespace(
        entry_id="entry-1",
        data={
            CONF_USERNAME: "parent@example.test",
            CONF_PHPSESSID: "secret-session-cookie",
            CONF_SUBDOMAIN: "private-school",
            CONF_STUDENT_ID: "student-123",
            CONF_STUDENT_NAME: "Private Student",
        },
        options={CONF_SUBJECT_IDS: ["math", "english"]},
    )

    diagnostics = await async_get_config_entry_diagnostics(hass, entry)
    serialized = str(diagnostics)

    assert "parent@example.test" not in serialized
    assert "secret-session-cookie" not in serialized
    assert "private-school" not in serialized
    assert "student-123" not in serialized
    assert "Private Student" not in serialized
    assert diagnostics["runtime"]["loaded"] is True
    assert diagnostics["runtime"]["last_update_success"] is True
    assert diagnostics["runtime"]["update_interval_seconds"] == 1800
    assert diagnostics["options"]["selected_subject_count"] == 2
    assert diagnostics["capabilities"]["notifications"]["types"] == {"message": 1}


@pytest.mark.asyncio
async def test_config_entry_diagnostics_handles_unloaded_entry():
    hass = SimpleNamespace(data={DOMAIN: {}})
    entry = SimpleNamespace(
        entry_id="entry-1",
        data={CONF_USERNAME: "parent@example.test"},
        options={},
    )

    diagnostics = await async_get_config_entry_diagnostics(hass, entry)

    assert diagnostics["runtime"] == {"loaded": False}
    assert "capabilities" not in diagnostics
    assert "parent@example.test" not in str(diagnostics)
