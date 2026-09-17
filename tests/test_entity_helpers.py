"""Tests for shared EduPage entity helpers."""

from custom_components.homeassistantedupage.const import DOMAIN
from custom_components.homeassistantedupage.entity_helpers import (
    compact_entity_name,
    student_device_info,
    student_initials,
)


def test_student_device_info_uses_stable_identifier():
    """Every platform receives the same per-student device definition."""
    device_info = student_device_info(42, "Max Example")

    assert device_info["identifiers"] == {(DOMAIN, "42")}
    assert device_info["name"] == "EduPage - Max Example"
    assert device_info["manufacturer"] == "EduPage"


def test_student_device_info_handles_missing_name():
    """Device construction remains safe during partial startup data."""
    device_info = student_device_info(42, None)

    assert device_info["name"] == "EduPage - 42"


def test_student_initials_use_first_letters_of_name_parts():
    assert student_initials("Patrik Ečery") == "PE"
    assert student_initials("Eva Ečery") == "EE"


def test_student_initials_handle_extra_whitespace_and_missing_name():
    assert student_initials("  Patrik   Ečery  ") == "PE"
    assert student_initials(None) == "?"


def test_compact_entity_name_adds_student_prefix():
    assert compact_entity_name("Patrik Ečery", "Dejepis") == "[PE] Dejepis"
    assert compact_entity_name("Eva Ečery", "Nesplnené DÚ") == "[EE] Nesplnené DÚ"
