"""Fast/slow polling orchestration for the EduPage coordinator."""

from __future__ import annotations

from copy import copy
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable

from .school_context import event_type_value


FAST_REFRESH_INTERVAL = timedelta(minutes=2)
SLOW_REFRESH_INTERVAL = timedelta(minutes=30)

INVALIDATING_EVENT_TYPES = {
    "substitution",
    "h_substitution",
    "timetable",
    "h_timetable",
    "changeroom",
    "bookroom",
}

# A failed freshness flag maps to one or more cached values that must retain
# their last successful value instead of being replaced by an empty fallback.
_SECTION_KEYS = {
    "grades": ("grades",),
    "subjects": ("subjects",),
    "timetable": ("timetable", "cancelled_lessons"),
    "canteen_menu": ("canteen_menu",),
    "timetable_changes": ("timetable_changes",),
    "missing_teachers": ("missing_teachers",),
    "next_ringing": ("next_ringing",),
    "school_year": ("school_year",),
    "grades_per_term": ("grades_per_term",),
}

SlowLoader = Callable[..., Awaitable[dict[str, Any]]]


class EduPageDataManager:
    """Combine a fast timeline refresh with TTL-cached slower EduPage data."""

    def __init__(self, slow_loader: SlowLoader) -> None:
        self._slow_loader = slow_loader
        self._slow_cache: dict[str, Any] = {}
        self._slow_last_refresh: datetime | None = None
        self._notifications: list[Any] = []
        self._known_notification_ids: set[Any] = set()

    @staticmethod
    def _event_ids(events: list[Any]) -> set[Any]:
        return {
            event_id
            for event in events or []
            if (event_id := getattr(event, "event_id", None)) is not None
        }

    def _has_new_invalidation_event(self, events: list[Any]) -> bool:
        """Return whether a newly seen timeline item invalidates slow data."""
        for event in events or []:
            event_id = getattr(event, "event_id", None)
            if event_id is None or event_id in self._known_notification_ids:
                continue
            if event_type_value(event) in INVALIDATING_EVENT_TYPES:
                return True
        return False

    def _slow_due(self, now: datetime, force: bool) -> bool:
        if force or self._slow_last_refresh is None or not self._slow_cache:
            return True
        return now - self._slow_last_refresh >= SLOW_REFRESH_INTERVAL

    def _merge_slow(self, fresh: dict[str, Any]) -> dict[str, Any]:
        """Merge slow data while retaining previous values for failed sections."""
        if not self._slow_cache:
            return dict(fresh)

        merged = dict(self._slow_cache)
        fresh_ok = dict(fresh.get("data_ok", {}) or {})
        old_ok = dict(merged.get("data_ok", {}) or {})

        # Values not controlled by a freshness section (student metadata, for
        # example) can always take the latest successful loader result.
        controlled = {key for keys in _SECTION_KEYS.values() for key in keys}
        for key, value in fresh.items():
            if key not in controlled and key != "data_ok":
                merged[key] = value

        for section, data_keys in _SECTION_KEYS.items():
            section_ok = fresh_ok.get(section, True)
            for key in data_keys:
                if section_ok or key not in merged:
                    if key in fresh:
                        merged[key] = fresh[key]
            old_ok[section] = section_ok

        # Preserve any additional freshness keys a future loader adds.
        old_ok.update(fresh_ok)
        merged["data_ok"] = old_ok
        return merged

    async def async_collect(
        self,
        edupage,
        student,
        student_name: str,
        *,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        """Collect fast timeline data and refresh slow sections only when due."""
        now = now or datetime.now()

        notifications_ok = True
        force_slow = False
        try:
            notifications = await edupage.get_notifications()
            notifications = list(notifications or [])
            force_slow = self._has_new_invalidation_event(notifications)
            self._notifications = notifications
            self._known_notification_ids.update(self._event_ids(notifications))
        except Exception:  # noqa: BLE001 - section failure must not break update
            notifications_ok = False
            notifications = self._notifications

        if self._slow_due(now, force_slow):
            fresh_slow = await self._slow_loader(
                edupage,
                student,
                student_name,
                fetch_notifications=False,
            )
            self._slow_cache = self._merge_slow(fresh_slow)
            self._slow_last_refresh = now

        result = dict(self._slow_cache)
        data_ok = dict(result.get("data_ok", {}) or {})
        data_ok["notifications"] = notifications_ok
        result["data_ok"] = data_ok
        result["notifications"] = list(notifications or [])
        result["last_updated"] = now.isoformat()
        if self._slow_last_refresh is not None:
            result["slow_last_updated"] = self._slow_last_refresh.isoformat()
        return result
