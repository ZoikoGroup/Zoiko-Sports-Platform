# P7 — Notifications and acknowledgments

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P7 | ⬜ Pending | B | P6 (core: P4 + P6 event formats, see D-035) | GI2, GB3, GB6 | Notifications bell |

**Objective:** a delivered message is never treated as a confirmed one.

**Layer:** L4. **Track:** platform (B).

**Entry criteria:** P6 merged (approved roadmap). D-035 proposes building P7.1–P7.4 during P6, against the event formats P6 publishes first, and connecting them when P6 merges. Until D-035 is confirmed, wait for P6.

**Company decisions needed:**
- Notification channels and email provider (GI2). Until chosen: in-app plus email behind an adapter, with the console backend locally.
- Overdue and escalation rules (GB3).
- Whether a new schedule version resets earlier acknowledgments (GB6).

**Source requirements:** FSD §17 (delivery ≠ acknowledgment), FSD T14, T15, T16; HO T05, T07, T08.

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P7.1 | Tables: notice, recipient, delivery attempt, acknowledgment | ⬜ Pending | B | P4 | |
| P7.2 | Sending pipeline: event → notices; access re-checked before sending; inbox; email adapter | ⬜ Pending | B | P7.1, P6.1 | |
| P7.3 | Read versus acknowledged kept separate; acknowledgment tied to a person and a version | ⬜ Pending | B | P7.1 | |
| P7.4 | Badge and unread-count endpoints for cheap polling | ⬜ Pending | B | P7.1 | |

### P7.1 Tables
- Planned code: new module `backend/notifications/`. Acknowledgment unique per recipient and version.

### P7.2 Sending pipeline
- Consumes `fixture.schedule_published` (format owned by `scheduling/events.py`). Recipients are the organizations currently participating in the event; each one's access is re-checked just before sending.
- Email goes through an adapter (the plan recommends django-anymail once the provider is chosen).

### P7.3 Read versus acknowledged
- Acknowledging is idempotent and never automatic; a provider's "delivered" status never sets "acknowledged".

### P7.4 Badges
- `GET /api/v1/me/notifications/`, `POST …/{id}/read`, `POST …/{id}/acknowledge`, `GET /api/v1/me/badges/`. Unchanged responses come back empty (conditional requests).

## Exit criteria

- [ ] FSD T14, T15 and T16 pass.
- [ ] A recipient revoked after the message is queued receives nothing.
- [ ] Replaying an event creates no duplicate notices.

## Frontend unlocked

- The notifications bell in the Organizer shell.
- The real recipient list in the fixture drawer.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
