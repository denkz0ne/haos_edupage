from datetime import date, datetime, time
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from custom_components.homeassistantedupage.school_context import (
    chip_direction,
    current_lesson,
    first_lesson,
    latest_event,
    next_lesson,
    school_end,
    school_presence_from_chip_events,
    school_today,
    student_events,
    today_event_exists,
)


TZ = ZoneInfo("Europe/Bratislava")
TODAY = date(2026, 9, 17)


def _event(event_type, text, timestamp, recipient="Patrik Ečery", additional_data=None):
    return SimpleNamespace(
        event_type=SimpleNamespace(value=event_type),
        text=text,
        timestamp=timestamp,
        recipient=recipient,
        author="School",
        additional_data=additional_data or {},
        event_id=int(timestamp.timestamp()),
    )


def _lesson(subject, start_hm, end_hm, *, cancelled=False, room="101", teacher="Teacher"):
    sh, sm = start_hm
    eh, em = end_hm
    return SimpleNamespace(
        subject=SimpleNamespace(name=subject),
        start_time=time(sh, sm),
        end_time=time(eh, em),
        is_cancelled=cancelled,
        classrooms=[SimpleNamespace(name=room)] if room else [],
        teachers=[SimpleNamespace(name=teacher)] if teacher else [],
    )


def test_chip_direction_recognizes_arrival_with_diacritics_and_case():
    assert chip_direction(_event("pipnutie", "Príchod 17.09.2026 07:56:58", datetime(2026, 9, 17, 7, 56, 58))) == "arrival"
    assert chip_direction(_event("pipnutie", "PRICHOD 17.09.2026 07:56:58", datetime(2026, 9, 17, 7, 56, 58))) == "arrival"


def test_chip_direction_recognizes_departure():
    assert chip_direction(_event("pipnutie", "Odchod 17.09.2026 11:58:26", datetime(2026, 9, 17, 11, 58, 26))) == "departure"


def test_chip_direction_keeps_other_chip_scans_unknown():
    assert chip_direction(_event("pipnutie", "Čip priložený", datetime(2026, 9, 17, 12, 0))) == "other"
    assert chip_direction(_event("sprava", "Príchod", datetime(2026, 9, 17, 12, 0))) == "other"


def test_student_events_filter_type_and_student(monkeypatch):
    events = [
        _event("pipnutie", "Príchod", datetime(2026, 9, 17, 7, 0), "Patrik Ečery"),
        _event("pipnutie", "Príchod", datetime(2026, 9, 17, 7, 1), "Emma Ečery"),
        _event("strava_vydaj", "Obed", datetime(2026, 9, 17, 12, 0), "Patrik Ečery"),
    ]

    def fake_matches(event, student_id, student_name, class_names):
        return event.recipient == student_name

    monkeypatch.setattr(
        "custom_components.homeassistantedupage.school_context.event_matches_student",
        fake_matches,
    )

    filtered = student_events(events, "1", "Patrik Ečery", [], event_type="pipnutie")
    assert filtered == [events[0]]


def test_latest_event_and_today_event_exists():
    older = _event("pipnutie", "Príchod", datetime(2026, 9, 16, 8, 0))
    newer = _event("pipnutie", "Odchod", datetime(2026, 9, 17, 11, 58, 26))
    assert latest_event([older, newer]) is newer
    assert today_event_exists([older, newer], TODAY)
    assert not today_event_exists([older], TODAY)


def test_school_presence_uses_latest_recognized_chip_event_today():
    arrival = _event("pipnutie", "Príchod 17.09.2026 07:56:58", datetime(2026, 9, 17, 7, 56, 58))
    other = _event("pipnutie", "Iné čipnutie", datetime(2026, 9, 17, 10, 0))
    departure = _event("pipnutie", "Odchod 17.09.2026 11:58:26", datetime(2026, 9, 17, 11, 58, 26))

    assert school_presence_from_chip_events([arrival, other], TODAY) is True
    assert school_presence_from_chip_events([arrival, other, departure], TODAY) is False
    assert school_presence_from_chip_events([other], TODAY) is None
    assert school_presence_from_chip_events([arrival], date(2026, 9, 18)) is None


def test_timetable_helpers_find_first_current_next_and_end():
    math = _lesson("Matematika", (8, 0), (8, 45))
    slovak = _lesson("Slovenčina", (8, 55), (9, 40))
    english = _lesson("Angličtina", (10, 0), (10, 45))
    timetable = {TODAY: [math, slovak, english]}

    now = datetime(2026, 9, 17, 9, 10, tzinfo=TZ)
    assert first_lesson(timetable, TODAY) is math
    assert current_lesson(timetable, now) is slovak
    assert next_lesson(timetable, now) == (TODAY, english)
    assert school_end(timetable, TODAY, TZ) == datetime(2026, 9, 17, 10, 45, tzinfo=TZ)
    assert school_today(timetable, TODAY)


def test_next_lesson_can_cross_to_next_school_day():
    tomorrow = date(2026, 9, 18)
    tomorrow_lesson = _lesson("Biológia", (8, 0), (8, 45))
    timetable = {TODAY: [], tomorrow: [tomorrow_lesson]}
    now = datetime(2026, 9, 17, 16, 0, tzinfo=TZ)
    assert next_lesson(timetable, now) == (tomorrow, tomorrow_lesson)


def test_cancelled_lessons_do_not_define_school_end_or_school_today():
    cancelled = _lesson("Telesná", (12, 0), (12, 45), cancelled=True)
    active = _lesson("Matematika", (11, 0), (11, 45))
    timetable = {TODAY: [active, cancelled]}
    assert school_end(timetable, TODAY, TZ) == datetime(2026, 9, 17, 11, 45, tzinfo=TZ)
    assert school_today(timetable, TODAY)
    assert not school_today({TODAY: [cancelled]}, TODAY)
    assert school_end({TODAY: [cancelled]}, TODAY, TZ) is None
