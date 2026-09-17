"""Sensor entities derived from EduPage school context."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable
from zoneinfo import ZoneInfo

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .entity_helpers import student_device_info
from .school_context import (
    CHIP_EVENT_TYPE,
    FOOD_SERVED_EVENT_TYPE,
    chip_direction,
    current_lesson,
    first_lesson,
    latest_event,
    next_lesson,
    school_end,
    student_events,
)


def _section_fresh(coordinator, key: str) -> bool:
    if not coordinator.last_update_success or not coordinator.data:
        return False
    return bool(coordinator.data.get("data_ok", {}).get(key, True))


def _local_tz(coordinator) -> ZoneInfo:
    return ZoneInfo(coordinator.hass.config.time_zone)


def _local_timestamp(coordinator, value: datetime | None) -> datetime | None:
    if value is None:
        return None
    tz = _local_tz(coordinator)
    if value.tzinfo is None:
        return value.replace(tzinfo=tz)
    return value.astimezone(tz)


def _lesson_subject(lesson: Any) -> str | None:
    subject = getattr(lesson, "subject", None)
    return getattr(subject, "name", None) if subject is not None else None


def _lesson_attributes(coordinator, day: date, lesson: Any) -> dict[str, Any]:
    tz = _local_tz(coordinator)
    start = datetime.combine(day, lesson.start_time, tzinfo=tz)
    end = datetime.combine(day, lesson.end_time, tzinfo=tz)
    classrooms = getattr(lesson, "classrooms", None) or []
    teachers = getattr(lesson, "teachers", None) or []
    attrs: dict[str, Any] = {
        "date": day.isoformat(),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "teachers": [
            name
            for teacher in teachers
            if (name := getattr(teacher, "name", None))
        ],
    }
    if classrooms and (room := getattr(classrooms[0], "name", None)):
        attrs["room"] = room
    return attrs


class EduPageSchoolContextSensor(CoordinatorEntity, SensorEntity):
    """Common child-scoped base for school-context sensors."""

    _data_key = "notifications"

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator)
        self._student_id = student_id
        self._student_name = student_name or str(student_id)
        student = coordinator.data.get("student", {}) if coordinator.data else {}
        self._student_class_names = student.get("class_names", [])
        self._attr_device_info = student_device_info(student_id, self._student_name)

    @property
    def data_stale(self) -> bool:
        return not _section_fresh(self.coordinator, self._data_key)

    def _events(self, event_type: str | None = None) -> list[Any]:
        notifications = (
            self.coordinator.data.get("notifications", [])
            if self.coordinator.data
            else []
        )
        return student_events(
            notifications or [],
            self._student_id,
            self._student_name,
            self._student_class_names,
            event_type=event_type,
        )


class EduPageTimelineTimestampSensor(
    EduPageSchoolContextSensor, RestoreEntity
):
    """Restore-capable timestamp sensor based on one timeline event family."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _event_type: str | None = None
    _predicate: Callable[[Any], bool] | None = None
    _last_value: datetime | None = None

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        previous = await self.async_get_last_state()
        if previous is None or previous.state in ("unknown", "unavailable"):
            return
        try:
            value = datetime.fromisoformat(previous.state)
        except (TypeError, ValueError):
            return
        self._last_value = _local_timestamp(self.coordinator, value)

    def _matching_events(self) -> list[Any]:
        events = self._events(self._event_type)
        if self._predicate is not None:
            events = [event for event in events if self._predicate(event)]
        return events

    def _latest(self) -> Any | None:
        return latest_event(self._matching_events())

    @property
    def native_value(self) -> datetime | None:
        event = self._latest()
        if event is not None:
            value = _local_timestamp(
                self.coordinator, getattr(event, "timestamp", None)
            )
            if value is not None:
                self._last_value = value
        return self._last_value

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"data_stale": self.data_stale}


class EduPageLastChipSensor(EduPageTimelineTimestampSensor):
    _event_type = CHIP_EVENT_TYPE

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Posledné pipnutie {self._student_name}"
        self._attr_unique_id = f"edupage_last_chip_{student_id}"
        self._attr_icon = "mdi:card-account-details-outline"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        event = self._latest()
        return {
            "direction": chip_direction(event) if event is not None else "other",
            "data_stale": self.data_stale,
        }


class EduPageLastArrivalSensor(EduPageTimelineTimestampSensor):
    _event_type = CHIP_EVENT_TYPE
    _predicate = staticmethod(lambda event: chip_direction(event) == "arrival")

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Posledný príchod do školy {self._student_name}"
        self._attr_unique_id = f"edupage_last_arrival_{student_id}"
        self._attr_icon = "mdi:location-enter"


class EduPageLastDepartureSensor(EduPageTimelineTimestampSensor):
    _event_type = CHIP_EVENT_TYPE
    _predicate = staticmethod(lambda event: chip_direction(event) == "departure")

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Posledný odchod zo školy {self._student_name}"
        self._attr_unique_id = f"edupage_last_departure_{student_id}"
        self._attr_icon = "mdi:location-exit"


class EduPageLastFoodServedSensor(EduPageTimelineTimestampSensor):
    _event_type = FOOD_SERVED_EVENT_TYPE

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Posledný výdaj stravy {self._student_name}"
        self._attr_unique_id = f"edupage_last_food_served_{student_id}"
        self._attr_icon = "mdi:food"


class EduPageTimetableSensor(EduPageSchoolContextSensor):
    """Base for sensors derived from the loaded timetable."""

    _data_key = "timetable"

    @property
    def _timetable(self) -> dict:
        return (
            self.coordinator.data.get("timetable", {})
            if self.coordinator.data
            else {}
        )

    @property
    def _now(self) -> datetime:
        return dt_util.now()

    @property
    def available(self) -> bool:
        return _section_fresh(self.coordinator, "timetable")


class EduPageFirstLessonSensor(EduPageTimetableSensor):
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Prvá hodina {self._student_name}"
        self._attr_unique_id = f"edupage_first_lesson_{student_id}"
        self._attr_icon = "mdi:clock-start"

    @property
    def native_value(self) -> datetime | None:
        if not _section_fresh(self.coordinator, "timetable"):
            return None
        now = self._now
        lesson = first_lesson(self._timetable, now.date())
        if lesson is None:
            return None
        return datetime.combine(
            now.date(), lesson.start_time, tzinfo=_local_tz(self.coordinator)
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"data_stale": self.data_stale}


class EduPageSchoolEndSensor(EduPageTimetableSensor):
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Koniec vyučovania {self._student_name}"
        self._attr_unique_id = f"edupage_school_end_{student_id}"
        self._attr_icon = "mdi:clock-end"

    @property
    def native_value(self) -> datetime | None:
        if not _section_fresh(self.coordinator, "timetable"):
            return None
        now = self._now
        return school_end(
            self._timetable,
            now.date(),
            _local_tz(self.coordinator),
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"data_stale": self.data_stale}


class EduPageCurrentLessonSensor(EduPageTimetableSensor):
    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Aktuálna hodina {self._student_name}"
        self._attr_unique_id = f"edupage_current_lesson_{student_id}"
        self._attr_icon = "mdi:book-open-variant"

    def _current(self) -> Any | None:
        if not _section_fresh(self.coordinator, "timetable"):
            return None
        return current_lesson(self._timetable, self._now)

    @property
    def native_value(self) -> str | None:
        lesson = self._current()
        return _lesson_subject(lesson) if lesson is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        lesson = self._current()
        attrs: dict[str, Any] = {"data_stale": self.data_stale}
        if lesson is not None:
            attrs.update(
                _lesson_attributes(self.coordinator, self._now.date(), lesson)
            )
        return attrs


class EduPageNextLessonSensor(EduPageTimetableSensor):
    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Ďalšia hodina {self._student_name}"
        self._attr_unique_id = f"edupage_next_lesson_{student_id}"
        self._attr_icon = "mdi:book-clock-outline"

    def _next(self) -> tuple[date, Any] | None:
        if not _section_fresh(self.coordinator, "timetable"):
            return None
        return next_lesson(self._timetable, self._now)

    @property
    def native_value(self) -> str | None:
        item = self._next()
        return _lesson_subject(item[1]) if item is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        item = self._next()
        attrs: dict[str, Any] = {"data_stale": self.data_stale}
        if item is not None:
            day, lesson = item
            attrs.update(_lesson_attributes(self.coordinator, day, lesson))
        return attrs


def school_context_sensors(coordinator, student_id, student_name) -> list[SensorEntity]:
    """Return every school-context sensor for one child."""
    return [
        EduPageLastChipSensor(coordinator, student_id, student_name),
        EduPageLastArrivalSensor(coordinator, student_id, student_name),
        EduPageLastDepartureSensor(coordinator, student_id, student_name),
        EduPageLastFoodServedSensor(coordinator, student_id, student_name),
        EduPageFirstLessonSensor(coordinator, student_id, student_name),
        EduPageCurrentLessonSensor(coordinator, student_id, student_name),
        EduPageNextLessonSensor(coordinator, student_id, student_name),
        EduPageSchoolEndSensor(coordinator, student_id, student_name),
    ]
