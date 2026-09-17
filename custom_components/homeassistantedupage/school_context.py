"""Pure helpers for EduPage school-context entities and events."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Iterable

from unidecode import unidecode

from .assignment_helpers import event_matches_student


CHIP_EVENT_TYPE = "pipnutie"
FOOD_SERVED_EVENT_TYPE = "strava_vydaj"


def event_type_value(event: Any) -> str:
    """Return the raw EduPage timeline type as a stable string."""
    event_type = getattr(event, "event_type", None)
    return str(getattr(event_type, "value", event_type) or "")


def _normalized_text(value: Any) -> str:
    """Normalize user-facing EduPage text for robust prefix matching."""
    return " ".join(unidecode(str(value or "")).casefold().split())


def chip_direction(event: Any) -> str:
    """Classify a generic ``pipnutie`` event as arrival/departure/other.

    Real EduPage data uses the same timeline type for multiple chip-reader
    actions. The currently verified discriminator is the localized event text
    prefix (``Príchod`` / ``Odchod``). Unknown chip scans deliberately remain
    ``other`` and must not change school-presence state.
    """
    if event_type_value(event) != CHIP_EVENT_TYPE:
        return "other"

    text = _normalized_text(getattr(event, "text", None))
    if text.startswith("prichod"):
        return "arrival"
    if text.startswith("odchod"):
        return "departure"
    return "other"


def student_events(
    events: Iterable[Any],
    student_id: Any,
    student_name: str | None,
    class_names: Iterable[str] = (),
    *,
    event_type: str | None = None,
) -> list[Any]:
    """Return timeline events safely assigned to one student."""
    return [
        event
        for event in events or []
        if (event_type is None or event_type_value(event) == event_type)
        and event_matches_student(event, student_id, student_name, class_names)
    ]


def latest_event(events: Iterable[Any]) -> Any | None:
    """Return the event with the newest timestamp."""
    candidates = [
        event for event in events or [] if getattr(event, "timestamp", None) is not None
    ]
    return max(candidates, key=lambda event: event.timestamp) if candidates else None


def today_event_exists(events: Iterable[Any], day: date) -> bool:
    """Return whether any event timestamp belongs to ``day``."""
    return any(
        getattr(event, "timestamp", None) is not None
        and event.timestamp.date() == day
        for event in events or []
    )


def school_presence_from_chip_events(
    events: Iterable[Any], day: date
) -> bool | None:
    """Derive school presence from today's latest recognized chip direction."""
    recognized = [
        event
        for event in events or []
        if getattr(event, "timestamp", None) is not None
        and event.timestamp.date() == day
        and chip_direction(event) in {"arrival", "departure"}
    ]
    latest = latest_event(recognized)
    if latest is None:
        return None
    return chip_direction(latest) == "arrival"


def _active_lessons(timetable: dict, day: date) -> list[Any]:
    """Return non-cancelled lessons for one day ordered by start time."""
    return sorted(
        [
            lesson
            for lesson in (timetable or {}).get(day, []) or []
            if not bool(getattr(lesson, "is_cancelled", False))
        ],
        key=lambda lesson: lesson.start_time,
    )


def school_today(timetable: dict, day: date) -> bool:
    """Return whether the student has at least one active lesson today."""
    return bool(_active_lessons(timetable, day))


def first_lesson(timetable: dict, day: date) -> Any | None:
    """Return the first active lesson of ``day``."""
    lessons = _active_lessons(timetable, day)
    return lessons[0] if lessons else None


def current_lesson(timetable: dict, now: datetime) -> Any | None:
    """Return the active lesson currently in progress."""
    for lesson in _active_lessons(timetable, now.date()):
        if lesson.start_time <= now.time().replace(tzinfo=None) < lesson.end_time:
            return lesson
    return None


def next_lesson(timetable: dict, now: datetime) -> tuple[date, Any] | None:
    """Return the next active lesson today or on a future loaded day."""
    for day in sorted((timetable or {}).keys()):
        if day < now.date():
            continue
        for lesson in _active_lessons(timetable, day):
            start = datetime.combine(day, lesson.start_time, tzinfo=now.tzinfo)
            if start > now:
                return day, lesson
    return None


def school_end(timetable: dict, day: date, tzinfo) -> datetime | None:
    """Return the end timestamp of the last active lesson of ``day``."""
    lessons = _active_lessons(timetable, day)
    if not lessons:
        return None
    return datetime.combine(day, lessons[-1].end_time, tzinfo=tzinfo)
