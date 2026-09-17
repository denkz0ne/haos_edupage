"""Regression tests for the personal fork's Slovak user interface."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
INTEGRATION = ROOT / "custom_components" / "homeassistantedupage"


def test_slovak_translation_uses_edupage_terminology() -> None:
    """Keep the Slovak translation complete and aligned with EduPage wording."""
    translation = json.loads((INTEGRATION / "translations" / "sk.json").read_text())

    assert translation["config"]["step"]["user"]["title"] == "Prihlásenie do EduPage"
    assert translation["config"]["step"]["select_student"]["data"]["student"] == "Žiak"
    assert translation["options"]["step"]["init"]["title"] == "Výber predmetov"
    assert translation["device_automation"]["trigger_type"]["new_exam"] == (
        "Bola zadaná nová písomka alebo skúšanie"
    )

    assert translation["selector"]["meal_type"]["options"] == {
        "snack": "Desiata",
        "lunch": "Obed",
        "afternoon_snack": "Olovrant",
    }
    assert translation["services"]["sign_off_meal"]["name"] == "Odhlásiť stravu"
    assert translation["services"]["send_message"]["name"] == "Odoslať správu"


def test_user_visible_entity_text_is_slovak() -> None:
    """Do not regress the fork's entity/calendar/TODO labels to English."""
    sensor = (INTEGRATION / "sensor.py").read_text()
    calendar = (INTEGRATION / "calendar.py").read_text()
    todo = (INTEGRATION / "todo.py").read_text()
    event = (INTEGRATION / "event.py").read_text()

    expected = {
        sensor: [
            "Nesplnené domáce úlohy",
            "Domáce úlohy po termíne",
            "Najbližší termín domácej úlohy",
            "Nadchádzajúce písomky a skúšanie",
            "Chýbajúci učitelia",
            "Najbližšie zvonenie",
            'term_label = "1. polrok" if term_key == "first" else "2. polrok"',
            'f"EduPage - Priemer za {term_label} {student_name}"',
        ],
        calendar: [
            "Rozvrh",
            "Jedálny lístok",
            "Vyučujúci:",
            "Učebňa:",
            "[Odpadlo]",
            "DÚ a písomky",
            "Písomka/skúšanie",
        ],
        todo: ["Domáce úlohy", "Predmet:", "Zadal:"],
        event: ["Udalosti"],
    }

    for source, phrases in expected.items():
        for phrase in phrases:
            assert phrase in source

    forbidden = [
        "Open homework",
        "Overdue homework",
        "Next homework deadline",
        "Upcoming exams",
        "Timetable Changes",
        "Missing Teachers",
        "Next Ringing",
        "Term Average",
        "Teacher(s):",
        "Room:",
        "[Canceled]",
        "Assignments ",
        "[Completed]",
        "Subject:",
        "Author:",
    ]
    combined = "\n".join((sensor, calendar, todo, event))
    for phrase in forbidden:
        assert phrase not in combined
