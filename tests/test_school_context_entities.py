"""Tests for Recorder-friendly school context entities."""

from datetime import datetime, time, timezone
from types import SimpleNamespace
import logging

import pytest
from homeassistant.components.binary_sensor import BinarySensorDeviceClass
from homeassistant.components.sensor import SensorDeviceClass
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from custom_components.homeassistantedupage.binary_sensor import (
    EduPageArrivalTodayBinarySensor,
    EduPageDepartureTodayBinarySensor,
    EduPageInSchoolBinarySensor,
    EduPageMealServedTodayBinarySensor,
    EduPageSchoolTodayBinarySensor,
    async_setup_entry as async_setup_binary_sensors,
)
from custom_components.homeassistantedupage.const import DOMAIN
from custom_components.homeassistantedupage.sensor import (
    EduPageCurrentLessonSensor,
    EduPageFirstLessonSensor,
    EduPageLastArrivalSensor,
    EduPageLastChipSensor,
    EduPageLastDepartureSensor,
    EduPageLastFoodServedSensor,
    EduPageNextLessonSensor,
    EduPageSchoolEndSensor,
    async_setup_entry as async_setup_sensors,
)


NOW = datetime(2026, 9, 17, 8, 30, tzinfo=timezone.utc)
TODAY = NOW.date()


def _event(event_id, event_type, text, hour, minute, second=0, recipient="Max Example"):
    return SimpleNamespace(
        event_id=event_id,
        event_type=SimpleNamespace(value=event_type),
        text=text,
        timestamp=datetime(2026, 9, 17, hour, minute, second),
        recipient=recipient,
        author="School",
        additional_data={},
    )


def _lesson(subject, start_hm, end_hm, *, room="101", teacher="Teacher"):
    return SimpleNamespace(
        subject=SimpleNamespace(name=subject),
        start_time=time(*start_hm),
        end_time=time(*end_hm),
        is_cancelled=False,
        classrooms=[SimpleNamespace(name=room)] if room else [],
        teachers=[SimpleNamespace(name=teacher)] if teacher else [],
    )


@pytest.fixture
def coordinator(hass: HomeAssistant):
    coord = DataUpdateCoordinator(
        hass,
        logging.getLogger("school-context-test"),
        name="school-context-test",
        config_entry=None,
    )
    coord.data = {
        "student": {"id": 1, "name": "Max Example", "class_names": ["4b"]},
        "notifications": [
            _event(1, "pipnutie", "Príchod 17.09.2026 07:56:58", 7, 56, 58),
            _event(2, "strava_vydaj", "Obed", 11, 30),
            _event(3, "pipnutie", "Odchod 17.09.2026 11:58:26", 11, 58, 26),
            # Newer sibling scan must not influence Max.
            _event(4, "pipnutie", "Príchod 17.09.2026 12:05:00", 12, 5, recipient="Anna Example"),
        ],
        "subjects": [],
        "grades": [],
        "timetable_changes": [],
        "missing_teachers": [],
        "next_ringing": None,
        "grades_per_term": {"first": [], "second": []},
        "timetable": {
            TODAY: [
                _lesson("Matematika", (8, 0), (8, 45)),
                _lesson("Angličtina", (9, 0), (9, 45), room="202", teacher="Nováková"),
            ]
        },
        "cancelled_lessons": {},
        "data_ok": {"notifications": True, "timetable": True},
    }
    coord.last_update_success = True
    return coord


@pytest.fixture(autouse=True)
def fixed_now(monkeypatch):
    monkeypatch.setattr(
        "custom_components.homeassistantedupage.sensor.dt_util.now",
        lambda: NOW,
    )
    monkeypatch.setattr(
        "custom_components.homeassistantedupage.binary_sensor.dt_util.now",
        lambda: NOW,
    )


def test_chip_timestamp_sensors_are_child_scoped_and_recorder_friendly(coordinator):
    last_chip = EduPageLastChipSensor(coordinator, 1, "Max Example")
    arrival = EduPageLastArrivalSensor(coordinator, 1, "Max Example")
    departure = EduPageLastDepartureSensor(coordinator, 1, "Max Example")
    food = EduPageLastFoodServedSensor(coordinator, 1, "Max Example")

    assert last_chip.device_class == SensorDeviceClass.TIMESTAMP
    assert last_chip.native_value.hour == 11
    assert last_chip.native_value.minute == 58
    assert last_chip.native_value.tzinfo is not None
    assert last_chip.extra_state_attributes == {
        "direction": "departure",
        "data_stale": False,
    }
    assert arrival.native_value.hour == 7
    assert arrival.native_value.minute == 56
    assert departure.native_value.second == 26
    assert food.native_value.hour == 11
    assert food.native_value.minute == 30
    assert all(
        sensor.device_info["identifiers"] == {(DOMAIN, "1")}
        for sensor in (last_chip, arrival, departure, food)
    )


def test_chip_binary_sensors_use_today_and_latest_recognized_direction(coordinator):
    arrival = EduPageArrivalTodayBinarySensor(coordinator, 1, "Max Example")
    departure = EduPageDepartureTodayBinarySensor(coordinator, 1, "Max Example")
    in_school = EduPageInSchoolBinarySensor(coordinator, 1, "Max Example")
    meal = EduPageMealServedTodayBinarySensor(coordinator, 1, "Max Example")

    assert arrival.is_on is True
    assert departure.is_on is True
    assert in_school.is_on is False
    assert in_school.device_class == BinarySensorDeviceClass.PRESENCE
    assert meal.is_on is True
    assert arrival.extra_state_attributes == {"data_stale": False}


def test_in_school_is_unknown_without_recognized_today_scan(coordinator):
    coordinator.data["notifications"] = [
        _event(5, "pipnutie", "Čip priložený", 10, 0)
    ]
    entity = EduPageInSchoolBinarySensor(coordinator, 1, "Max Example")
    assert entity.is_on is None


def test_notification_outage_keeps_cached_context_but_marks_it_stale(coordinator):
    coordinator.data["data_ok"]["notifications"] = False
    last_chip = EduPageLastChipSensor(coordinator, 1, "Max Example")
    arrival = EduPageArrivalTodayBinarySensor(coordinator, 1, "Max Example")

    assert last_chip.native_value is not None
    assert last_chip.extra_state_attributes["data_stale"] is True
    assert arrival.is_on is True
    assert arrival.extra_state_attributes == {"data_stale": True}


def test_timetable_sensors_expose_first_current_next_and_school_end(coordinator):
    first = EduPageFirstLessonSensor(coordinator, 1, "Max Example")
    current = EduPageCurrentLessonSensor(coordinator, 1, "Max Example")
    next_entity = EduPageNextLessonSensor(coordinator, 1, "Max Example")
    end = EduPageSchoolEndSensor(coordinator, 1, "Max Example")

    assert first.device_class == SensorDeviceClass.TIMESTAMP
    assert first.native_value.hour == 8
    assert current.native_value == "Matematika"
    assert current.extra_state_attributes["start"].endswith("08:00:00+00:00")
    assert current.extra_state_attributes["room"] == "101"
    assert next_entity.native_value == "Angličtina"
    assert next_entity.extra_state_attributes["start"].endswith("09:00:00+00:00")
    assert next_entity.extra_state_attributes["teachers"] == ["Nováková"]
    assert end.device_class == SensorDeviceClass.TIMESTAMP
    assert end.native_value.hour == 9
    assert end.native_value.minute == 45


def test_timetable_failure_is_unknown_not_false_school_day(coordinator):
    coordinator.data["data_ok"]["timetable"] = False
    first = EduPageFirstLessonSensor(coordinator, 1, "Max Example")
    school = EduPageSchoolTodayBinarySensor(coordinator, 1, "Max Example")

    assert first.native_value is None
    assert school.is_on is None
    assert school.extra_state_attributes == {"data_stale": True}


def test_school_today_true_for_loaded_day(coordinator):
    school = EduPageSchoolTodayBinarySensor(coordinator, 1, "Max Example")
    assert school.is_on is True
    assert school.extra_state_attributes == {"data_stale": False}


@pytest.mark.asyncio
async def test_sensor_platform_registers_all_school_context_sensors(hass, coordinator):
    entry = SimpleNamespace(
        entry_id="school-context-sensors",
        data={"student_id": 1, "student_name": "Max Example"},
        options={},
    )
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    added = []

    await async_setup_sensors(
        hass,
        entry,
        lambda entities, update_before_add=False: added.extend(entities),
    )

    expected = {
        EduPageLastChipSensor,
        EduPageLastArrivalSensor,
        EduPageLastDepartureSensor,
        EduPageLastFoodServedSensor,
        EduPageFirstLessonSensor,
        EduPageCurrentLessonSensor,
        EduPageNextLessonSensor,
        EduPageSchoolEndSensor,
    }
    assert expected.issubset({type(entity) for entity in added})


@pytest.mark.asyncio
async def test_binary_sensor_platform_registers_all_school_context_binary_sensors(
    hass, coordinator
):
    entry = SimpleNamespace(
        entry_id="school-context-binary",
        data={"student_id": 1, "student_name": "Max Example"},
        options={},
    )
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    added = []

    await async_setup_binary_sensors(
        hass,
        entry,
        lambda entities, update_before_add=False: added.extend(entities),
    )

    assert {type(entity) for entity in added} == {
        EduPageArrivalTodayBinarySensor,
        EduPageDepartureTodayBinarySensor,
        EduPageInSchoolBinarySensor,
        EduPageMealServedTodayBinarySensor,
        EduPageSchoolTodayBinarySensor,
    }
