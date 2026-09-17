"""Binary sensors for EduPage school context."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .const import CONF_STUDENT_ID, CONF_STUDENT_NAME, DOMAIN
from .entity_helpers import student_device_info
from .school_context import (
    CHIP_EVENT_TYPE,
    FOOD_SERVED_EVENT_TYPE,
    chip_direction,
    school_presence_from_chip_events,
    school_today,
    student_events,
    today_event_exists,
)


def _section_fresh(coordinator, key: str) -> bool:
    if not coordinator.last_update_success or not coordinator.data:
        return False
    return bool(coordinator.data.get("data_ok", {}).get(key, True))


class EduPageSchoolContextBinarySensor(CoordinatorEntity, BinarySensorEntity):
    """Common child-scoped base for school-context binary sensors."""

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

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"data_stale": self.data_stale}

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


class EduPageArrivalTodayBinarySensor(EduPageSchoolContextBinarySensor):
    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Príchod do školy dnes {self._student_name}"
        self._attr_unique_id = f"edupage_arrival_today_{student_id}"
        self._attr_icon = "mdi:location-enter"

    @property
    def is_on(self) -> bool:
        events = [
            event
            for event in self._events(CHIP_EVENT_TYPE)
            if chip_direction(event) == "arrival"
        ]
        return today_event_exists(events, dt_util.now().date())


class EduPageDepartureTodayBinarySensor(EduPageSchoolContextBinarySensor):
    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Odchod zo školy dnes {self._student_name}"
        self._attr_unique_id = f"edupage_departure_today_{student_id}"
        self._attr_icon = "mdi:location-exit"

    @property
    def is_on(self) -> bool:
        events = [
            event
            for event in self._events(CHIP_EVENT_TYPE)
            if chip_direction(event) == "departure"
        ]
        return today_event_exists(events, dt_util.now().date())


class EduPageInSchoolBinarySensor(EduPageSchoolContextBinarySensor):
    _attr_device_class = BinarySensorDeviceClass.PRESENCE

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - V škole podľa EduPage {self._student_name}"
        self._attr_unique_id = f"edupage_in_school_{student_id}"
        self._attr_icon = "mdi:school"

    @property
    def is_on(self) -> bool | None:
        return school_presence_from_chip_events(
            self._events(CHIP_EVENT_TYPE), dt_util.now().date()
        )


class EduPageMealServedTodayBinarySensor(EduPageSchoolContextBinarySensor):
    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Obed vydaný dnes {self._student_name}"
        self._attr_unique_id = f"edupage_meal_served_today_{student_id}"
        self._attr_icon = "mdi:food"

    @property
    def is_on(self) -> bool:
        return today_event_exists(
            self._events(FOOD_SERVED_EVENT_TYPE), dt_util.now().date()
        )


class EduPageSchoolTodayBinarySensor(EduPageSchoolContextBinarySensor):
    _data_key = "timetable"

    def __init__(self, coordinator, student_id, student_name) -> None:
        super().__init__(coordinator, student_id, student_name)
        self._attr_name = f"EduPage - Škola dnes {self._student_name}"
        self._attr_unique_id = f"edupage_school_today_{student_id}"
        self._attr_icon = "mdi:calendar-school"

    @property
    def is_on(self) -> bool | None:
        if not _section_fresh(self.coordinator, "timetable"):
            return None
        timetable = (
            self.coordinator.data.get("timetable", {})
            if self.coordinator.data
            else {}
        )
        return school_today(timetable, dt_util.now().date())


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up school-context binary sensors for one configured student."""
    coordinator = hass.data[DOMAIN][entry.entry_id]
    student = coordinator.data.get("student", {}) if coordinator.data else {}
    student_id = student.get("id") if student else entry.data.get(CONF_STUDENT_ID)
    student_name = (
        student.get("name")
        if student and student.get("name")
        else entry.data.get(CONF_STUDENT_NAME)
    )

    async_add_entities(
        [
            EduPageArrivalTodayBinarySensor(coordinator, student_id, student_name),
            EduPageDepartureTodayBinarySensor(coordinator, student_id, student_name),
            EduPageInSchoolBinarySensor(coordinator, student_id, student_name),
            EduPageMealServedTodayBinarySensor(coordinator, student_id, student_name),
            EduPageSchoolTodayBinarySensor(coordinator, student_id, student_name),
        ],
        True,
    )
