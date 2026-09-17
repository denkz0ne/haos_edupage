# haos_edupage roadmap

This fork stays intentionally close to `rine77/homeassistantedupage` so upstream fixes can be merged with minimal conflict.

## Development rules

- Keep `main` usable and close to upstream.
- Build changes on focused `feature/*` branches and merge through pull requests.
- Prefer extending `edupage-api` through upstream contributions when a missing capability belongs in the Python library rather than Home Assistant.
- Keep Home Assistant entity IDs/domain compatible with the upstream integration unless a breaking change is unavoidable.
- Never include EduPage passwords, PHP session IDs, raw authentication payloads or personal student data in logs, diagnostics, fixtures or issues.

## Phase 1 — discover real account capabilities

- [x] Privacy-safe Home Assistant diagnostics export.
- [ ] Inspect diagnostics from a real Slovak parent account.
- [ ] Catalogue all notification/timeline event types returned by the school.
- [ ] Identify data visible in EduPage web/app but missing from `edupage-api`.
- [ ] Capture and document relevant authenticated web requests where required.

## Phase 2 — school-day entities

- [ ] Current lesson sensor.
- [ ] Next lesson sensor.
- [ ] First lesson today sensor.
- [ ] School start/end sensors.
- [ ] Better timetable-change events scoped to the selected student.

## Phase 3 — faster event path

- [ ] Separate slow data polling from notification/timeline polling.
- [ ] Make polling intervals configurable within sensible EduPage limits.
- [ ] Improve structured event payloads for grades, homework, messages and timetable changes.

## Phase 4 — attendance and interaction research

- [ ] Determine whether parent accounts expose both arrival and departure events.
- [ ] Investigate absence/excuse data.
- [ ] Investigate marking homework complete.
- [ ] Investigate message reply/read/star actions.
- [ ] Investigate attachment upload/send support.

## Phase 5 — dashboard/automation ergonomics

- [ ] Compact daily school overview attributes/entities.
- [ ] Examples for morning overview, changed timetable, homework deadlines and new-grade automations.
- [ ] Consider a dedicated Lovelace card only if standard HA cards become a real limitation.
