# EduPage School Context 2026.09.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fast EduPage timeline polling, chip-based arrival/departure context, meal-served context, lesson-time sensors, Recorder-friendly binary/timestamp entities, dynamic chip events, and privacy-safe diagnostics.

**Architecture:** Keep one `DataUpdateCoordinator` ticking every 2 minutes. Cache slow API sections behind a 30-minute TTL, invalidate them when a new timetable/substitution timeline event appears, and expose school context through focused pure helpers plus sensor/binary-sensor platforms. Preserve `person.*` and `device_tracker.*` untouched.

**Tech Stack:** Home Assistant custom integration, Python 3.12 CI, `edupage-api==0.12.5`, pytest, `pytest-homeassistant-custom-component`.

**Spec:** `docs/superpowers/specs/2026-09-17-school-context-design.md`

## Global Constraints

- Integration domain/path remains `homeassistantedupage` / `custom_components/homeassistantedupage`.
- `person.*`, `device_tracker.*`, and HA zones are never modified.
- `pipnutie` is a generic chip scan; only recognized `Príchod`/`Odchod` scans change school-presence state.
- `strava_vydaj` is the authoritative meal-served event.
- Fast polling target: 2 minutes. Slow TTL target: 30 minutes.
- Failed fast/slow sections retain the previous successful cache.
- Child-specific events must pass `event_matches_student(...)`.
- Diagnostics must never expose names, IDs, sessions, subdomain, free text, author/recipient names, or raw scalar payload values.
- Friendly-name shortening to `[PE]/[EE]` is explicitly deferred until after this feature is merged.

---

### Task 1: Pure school-context helpers

**Files:**
- Create: `custom_components/homeassistantedupage/school_context.py`
- Create: `tests/test_school_context.py`

**Interfaces:**
- Produces `chip_direction(event) -> str`, `student_events(events, student_id, student_name, class_names, event_type=None) -> list`, `latest_event(...)`, `today_event_exists(...)`, `school_presence_from_chip_events(...)`, and timetable helper functions returning current/next/first/last lesson metadata.

- [ ] **Step 1:** Add failing tests for `Príchod`, `Odchod`, diacritics/case tolerance, unknown `pipnutie`, latest arrival/departure selection, current/next/first/end lesson selection, cancelled last lesson, and day without school.
- [ ] **Step 2:** Push test-only commit and verify GitHub Actions fails because `school_context.py` does not exist.
- [ ] **Step 3:** Implement minimal pure helpers in `school_context.py`.
- [ ] **Step 4:** Push implementation commit and verify targeted/full tests pass.

### Task 2: Fast/slow coordinator cache

**Files:**
- Modify: `custom_components/homeassistantedupage/__init__.py`
- Create: `tests/test_polling.py`

**Interfaces:**
- Coordinator `update_interval=timedelta(minutes=2)`.
- Slow cache TTL constant `SLOW_REFRESH_INTERVAL = timedelta(minutes=30)`.
- New timetable/substitution timeline types force slow refresh before TTL.

- [ ] **Step 1:** Add failing async tests with fake EduPage methods proving first refresh fetches fast+slow, second pre-TTL refresh fetches notifications only, TTL expiry fetches slow again, and a new timetable/substitution event invalidates slow cache.
- [ ] **Step 2:** Push test-only commit and verify expected failures.
- [ ] **Step 3:** Split collection into fast notifications and slow sections while preserving previous successful section data on failure.
- [ ] **Step 4:** Push implementation and verify polling tests plus existing suite.

### Task 3: Timestamp and binary school-context entities

**Files:**
- Modify: `custom_components/homeassistantedupage/sensor.py`
- Create: `custom_components/homeassistantedupage/binary_sensor.py`
- Modify: `custom_components/homeassistantedupage/__init__.py` platform forwarding
- Create: `tests/test_school_context_entities.py`

**Interfaces:**
- Timestamp sensors: last chip, last arrival, last departure, last food served, first lesson, school end.
- Text sensors: current lesson, next lesson.
- Binary sensors: arrival today, departure today, in school according to EduPage, meal served today, school today.

- [ ] **Step 1:** Add failing entity tests for states, device classes, child filtering, daily reset behavior, Recorder-friendly small attributes, and `None` school presence when no recognized chip event exists today.
- [ ] **Step 2:** Push tests and verify expected failures.
- [ ] **Step 3:** Implement sensors/binary sensors using `school_context.py`; do not mutate person/device trackers.
- [ ] **Step 4:** Push implementation and verify tests.

### Task 4: Dynamic chip event mapping

**Files:**
- Modify: `custom_components/homeassistantedupage/event.py`
- Modify: `tests/test_event.py`
- Modify: `tests/test_device_trigger.py`

**Interfaces:**
- Preserve `arrival_at_school` for recognized arrivals.
- Add `departure_from_school` for recognized departures.
- Add `chip_scan` for unrecognized `pipnutie`.

- [ ] **Step 1:** Add failing tests for arrival/departure/unknown chip mapping and device trigger enumeration.
- [ ] **Step 2:** Push tests and verify expected failures.
- [ ] **Step 3:** Implement dynamic mapping via `chip_direction()`.
- [ ] **Step 4:** Push implementation and verify tests.

### Task 5: Privacy-safe event diagnostics

**Files:**
- Modify: `custom_components/homeassistantedupage/diagnostics.py`
- Modify: `tests/test_diagnostics.py`

**Interfaces:**
- Target types: `pipnutie`, `strava_vydaj`, `h_attendance`, `h_process`, `h_processtypes`.
- Output includes counts, additional-data keys, value type names, timestamp-like key names, and safe chip direction counts only.

- [ ] **Step 1:** Add failing tests proving useful structural diagnostics are emitted while names, IDs, text, authors, recipients and scalar payload values are absent.
- [ ] **Step 2:** Push tests and verify expected failures.
- [ ] **Step 3:** Implement structural event diagnostics with no raw payload values.
- [ ] **Step 4:** Push implementation and verify diagnostics tests.

### Task 6: Release metadata and documentation

**Files:**
- Modify: `custom_components/homeassistantedupage/manifest.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md` only where new entities/polling need documenting
- Existing release metadata tests remain authoritative.

- [ ] **Step 1:** Change manifest version to `2026.09.2` and add matching changelog section.
- [ ] **Step 2:** Document fast timeline vs slow data behavior and new school-context entities without changing internal IDs of existing entities.
- [ ] **Step 3:** Push metadata/docs commit.

### Task 7: Full verification and PR

**Files:** all changed files.

- [ ] **Step 1:** Verify GitHub Actions `Tests` is green for the feature head.
- [ ] **Step 2:** Review the feature diff against the spec: no person/device-tracker writes, no raw diagnostics values, no friendly-name shortening yet.
- [ ] **Step 3:** Open/update PR to `main` with scope and testing summary.
- [ ] **Step 4:** Wait for PR checks and verify all required tests pass.
- [ ] **Step 5:** Merge only after green checks, then verify release workflow produces `2026.09.2`.
- [ ] **Step 6:** After merge, create a separate naming branch for `[PE]/[EE]` friendly-name shortening and execute it autonomously as requested.