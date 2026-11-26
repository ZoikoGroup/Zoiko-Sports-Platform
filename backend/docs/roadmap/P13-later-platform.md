# P13 — Later-phase platform

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P13 | ⬜ Pending | — | Each module's master specification | Per module | Platform beyond Phase 1 |

**Objective:** the platform beyond the Phase 1 pilot. Outside Phase 1 by the documents' own scope (FSD §01, HO §01).

**Entry criteria:** each module's master specification exists (the project register lists 27 specifications still to write). Nothing here starts on assumptions.

## Work packages (module groups)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P13.1 | Automatic fixture generation, schedule import, calendar sync | ⬜ Pending | — | P6; ZS-SCHED-001 | |
| P13.2 | Player registration and eligibility | ⬜ Pending | — | P5; ZS-REG-001 | |
| P13.3 | Results and standings | ⬜ Pending | — | P6; ZS-COMP-001 | |
| P13.4 | Officiating and discipline (enables officials-conflict detection) | ⬜ Pending | — | P6; ZS-OFF-001 | |
| P13.5 | Live events, integrations, commerce, media, AI | ⬜ Pending | — | P4; their specifications | |

### P13.1 Fixture generation, import, sync
- Reuses the fixture-creation service (P6). Fills the "Import Schedule" and "Sync Calendar" buttons, which say "not available" today.

### P13.2 Registration and eligibility
- Feeds participation (P5); fills the Overview's "Registered Teams" figure.

### P13.3 Results and standings
- Listens to "fixture published" (P6 events).

### P13.4 Officiating and discipline
- Makes officials-conflict detection possible in the Fixtures page.

### P13.5 Everything else
- New modules on the same event backbone (P4). The architecture deliberately does not adopt Kafka, Kubernetes, microservices, GraphQL or Elasticsearch now.

## Acceptance evidence

(Per module.)

## Progress log

(One line per merged pull request.)
