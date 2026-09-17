from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from custom_components.homeassistantedupage import _collect_data
from custom_components.homeassistantedupage.polling import (
    EduPageDataManager,
    FAST_REFRESH_INTERVAL,
    SLOW_REFRESH_INTERVAL,
)


NOW = datetime(2026, 9, 17, 8, 0, 0)


def _event(event_id, event_type):
    return SimpleNamespace(
        event_id=event_id,
        event_type=SimpleNamespace(value=event_type),
        timestamp=NOW,
        text="",
    )


class FakeEdupage:
    def __init__(self):
        self.notifications = []
        self.notification_calls = 0
        self.fail_notifications = False

    async def get_notifications(self):
        self.notification_calls += 1
        if self.fail_notifications:
            raise RuntimeError("timeline unavailable")
        return list(self.notifications)


class SlowLoader:
    def __init__(self):
        self.calls = 0
        self.fail_grades = False

    async def __call__(self, edupage, student, student_name, *, fetch_notifications=False):
        self.calls += 1
        return {
            "student": {"id": student.person_id, "name": student_name},
            "grades": [] if self.fail_grades else [f"grade-{self.calls}"],
            "subjects": ["Math"],
            "timetable": {NOW.date(): [f"lesson-{self.calls}"]},
            "cancelled_lessons": {},
            "canteen_menu": {},
            "timetable_changes": [],
            "missing_teachers": [],
            "next_ringing": None,
            "school_year": 2026,
            "grades_per_term": {"first": [], "second": []},
            "data_ok": {
                "grades": not self.fail_grades,
                "subjects": True,
                "timetable": True,
                "canteen_menu": True,
                "timetable_changes": True,
                "missing_teachers": True,
                "next_ringing": True,
                "school_year": True,
                "grades_per_term": True,
            },
        }


@pytest.fixture
def student():
    return SimpleNamespace(person_id="student-1", name="Patrik Ečery")


def test_polling_intervals_are_two_and_thirty_minutes():
    assert FAST_REFRESH_INTERVAL == timedelta(minutes=2)
    assert SLOW_REFRESH_INTERVAL == timedelta(minutes=30)


@pytest.mark.asyncio
async def test_first_refresh_fetches_fast_and_slow(student):
    api = FakeEdupage()
    slow = SlowLoader()
    manager = EduPageDataManager(slow)

    data = await manager.async_collect(api, student, student.name, now=NOW)

    assert api.notification_calls == 1
    assert slow.calls == 1
    assert data["grades"] == ["grade-1"]
    assert data["notifications"] == []
    assert data["data_ok"]["notifications"] is True


@pytest.mark.asyncio
async def test_pre_ttl_refresh_fetches_notifications_only(student):
    api = FakeEdupage()
    slow = SlowLoader()
    manager = EduPageDataManager(slow)

    await manager.async_collect(api, student, student.name, now=NOW)
    await manager.async_collect(api, student, student.name, now=NOW + timedelta(minutes=2))

    assert api.notification_calls == 2
    assert slow.calls == 1


@pytest.mark.asyncio
async def test_slow_data_refreshes_after_ttl(student):
    api = FakeEdupage()
    slow = SlowLoader()
    manager = EduPageDataManager(slow)

    await manager.async_collect(api, student, student.name, now=NOW)
    data = await manager.async_collect(
        api,
        student,
        student.name,
        now=NOW + SLOW_REFRESH_INTERVAL,
    )

    assert slow.calls == 2
    assert data["grades"] == ["grade-2"]


@pytest.mark.asyncio
async def test_new_timetable_event_invalidates_slow_cache_before_ttl(student):
    api = FakeEdupage()
    slow = SlowLoader()
    manager = EduPageDataManager(slow)

    await manager.async_collect(api, student, student.name, now=NOW)
    api.notifications = [_event(100, "timetable")]
    await manager.async_collect(api, student, student.name, now=NOW + timedelta(minutes=2))

    assert slow.calls == 2


@pytest.mark.asyncio
async def test_fast_failure_preserves_previous_notifications(student):
    api = FakeEdupage()
    api.notifications = [_event(1, "pipnutie")]
    slow = SlowLoader()
    manager = EduPageDataManager(slow)

    first = await manager.async_collect(api, student, student.name, now=NOW)
    api.fail_notifications = True
    second = await manager.async_collect(api, student, student.name, now=NOW + timedelta(minutes=2))

    assert second["notifications"] == first["notifications"]
    assert second["data_ok"]["notifications"] is False
    assert slow.calls == 1


@pytest.mark.asyncio
async def test_failed_slow_section_preserves_previous_successful_value(student):
    api = FakeEdupage()
    slow = SlowLoader()
    manager = EduPageDataManager(slow)

    first = await manager.async_collect(api, student, student.name, now=NOW)
    slow.fail_grades = True
    second = await manager.async_collect(
        api,
        student,
        student.name,
        now=NOW + SLOW_REFRESH_INTERVAL,
    )

    assert first["grades"] == ["grade-1"]
    assert second["grades"] == ["grade-1"]
    assert second["data_ok"]["grades"] is False


@pytest.mark.asyncio
async def test_collect_data_can_skip_notifications_for_slow_refresh(student):
    """Slow refresh must not make a second timeline request."""
    api = SimpleNamespace(
        get_grades=AsyncMock(return_value=[]),
        get_subjects=AsyncMock(return_value=[]),
        get_notifications=AsyncMock(side_effect=AssertionError("must not be called")),
        get_timetable=AsyncMock(return_value=[]),
        get_meals=AsyncMock(return_value=None),
        get_timetable_changes=AsyncMock(return_value=[]),
        get_missing_teachers=AsyncMock(return_value=[]),
        get_next_ringing_time=AsyncMock(return_value=None),
        get_school_year=AsyncMock(return_value=None),
        get_grades_for_term=AsyncMock(return_value=[]),
    )

    data = await _collect_data(
        api,
        student,
        student.name,
        fetch_notifications=False,
    )

    api.get_notifications.assert_not_called()
    assert "notifications" not in data
    assert "notifications" not in data["data_ok"]
