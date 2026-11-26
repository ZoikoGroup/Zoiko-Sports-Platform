# P12 — Remaining Phase 1 modules

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P12 | ⬜ Pending | A + B | P11 (or earlier on staging) | One per module | Remaining sidebar pages and workspaces |

**Objective:** the rest of Phase 1. Each module plugs into the existing engines (permissions, events, work items, notifications) without restructuring them.

**Layer:** L6. **One module per pull-request series**: each needs its own decisions.

**Entry criteria:** P11 done, or earlier on staging, plus the module's own decision. D-035 proposes P12.1 and P12.2 right after P8, because the pilot's golden event depends on them.

## Work packages (modules)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P12.1 | Venue readiness and evidence (file storage, malware scanning) | ⬜ Pending | A | P5, P8 | |
| P12.2 | Event-day exceptions | ⬜ Pending | A | P5, P8 | |
| P12.3 | Participating Organizations and Team & Access (self-service invitations) | ⬜ Pending | A | P3, P5 | |
| P12.4 | Reports and audit exports | ⬜ Pending | B | P3.7, P9 | |
| P12.5 | Venue and Club & Team workspaces | ⬜ Pending | A | P5–P8 | |
| P12.6 | Internal Administration (staff console) | ⬜ Pending | A | P3 | |
| P12.7 | Settings (B), Documents (A) and Help (B) | ⬜ Pending | A + B | P3; Documents needs P12.1 storage | |

### P12.1 Venue readiness
- Decisions: readiness-check states (K5: 4 versus 7 states), storage and malware-scanning vendor (GI3), file limits.
- Fills: Needs Attention venue items, Action Centre venue items, alerts. Golden fixture: 16 checks (14 shared, 2 not).

### P12.2 Event-day exceptions
- Decisions: exception states and severity scale (K6, GB4), escalation and contact directory.
- Fills: Operational Alerts; the Event-Day Coordination page. Golden scenario: the turnstile incident.

### P12.3 Participating Organizations and Team & Access
- Decisions: the role catalogue (GP1), delegation (GP2), bulk import rules.
- Also delivers the self-service invitation API deferred from P2 (P2.7, D-032).
- The first API that edits organizations and memberships: give those tables a `version` column (VersionedModel, 409 on stale edits), as the schema audit noted (D-046).

### P12.4 Reports and audit exports
- Decisions: export formats, retention (D09); export jobs run in the worker (P4).

### P12.5 Venue and Club & Team workspaces
- Decision: which fields venues and clubs may see (GP3; K7: the two permission matrices disagree).
- Fills the workspace switcher's other workspaces (today they open a placeholder page).

### P12.6 Internal Administration
- Decision: break-glass access procedure (D12). Replaces the operator command (`manage.py organizations`) for verifying and suspending organizations.

### P12.7 Settings, Documents and Help
- Decision: scope definitions (setting keys, user versus organization scope). Sports Hub and Media & Content have no specification (K2) and stay disabled.

## Exit criteria

Each module defines its own when it starts; every module must pass the permission matrix (P3.8) and the golden-event tests.

## Acceptance evidence

(One block per module when accepted.)

## Progress log

(One line per merged pull request.)
