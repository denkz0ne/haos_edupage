"""Regression tests for compact per-student friendly names."""

from pathlib import Path

PLATFORM_FILES = (
    Path("custom_components/homeassistantedupage/sensor.py"),
    Path("custom_components/homeassistantedupage/calendar.py"),
    Path("custom_components/homeassistantedupage/event.py"),
    Path("custom_components/homeassistantedupage/todo.py"),
)


def test_entity_platforms_do_not_embed_edupage_prefix_in_default_names():
    """Entity friendly names should use [initials], not repeated EduPage text."""
    for path in PLATFORM_FILES:
        source = path.read_text(encoding="utf-8")
        assert 'f"EduPage - ' not in source, path


def test_entity_platforms_use_shared_compact_name_helper():
    """Every entity platform should use the same student-prefix helper."""
    for path in PLATFORM_FILES:
        source = path.read_text(encoding="utf-8")
        assert "compact_entity_name" in source, path
