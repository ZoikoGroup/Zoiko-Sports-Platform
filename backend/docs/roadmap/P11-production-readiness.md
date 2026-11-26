# P11 — Production hardening and release

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P11 | ⬜ Pending | A + B | P1–P10 | GI5 hosting, SLOs, D09 retention | Controlled live pilot (gates G3/G4) |

**Objective:** ready for a controlled live pilot.

**Layer:** L6. **Tracks:** security half (A), infrastructure half (B). Preparation (monitoring dashboards, restore-drill and load-test scripts, runbooks) can start earlier; the phase is accepted only after P10.

**Entry criteria:** P1–P10 merged.

**Company decisions needed:**
- Hosting and CI provider (GI5).
- Approved service-level targets (ARCH proposes 99.95% for core APIs; unapproved).
- Data retention (D09).

**Source requirements:** ARCH §8 (SLOs, RPO/RTO, pilot capacity), ARCH §9.5, FSD T19, T20, T29, T35, T36; gaps GS1, GS2, GI5.

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P11.1 | Security review: ASVS mapped to routes, threat model, penetration test, fixes | ⬜ Pending | A | P10 | |
| P11.2 | Load and soak tests at pilot scale | ⬜ Pending | B | P10 | |
| P11.3 | Managed PostgreSQL with point-in-time recovery; restore drill | ⬜ Pending | B | GI5 | |
| P11.4 | Full monitoring: tracing, metrics, error tracking, alerts (outbox lag, dead letters) | ⬜ Pending | B | P4 | |
| P11.5 | Staging and production; zero-downtime migrations, rollback, runbooks, manual fallback | ⬜ Pending | B | GI5 | |

### P11.1 Security review
- OWASP ASVS 5.0 and API Top 10 mapped to every route; the permission matrix (P3.8) proves coverage.

### P11.2 Load tests
- At the architecture's pilot envelope (proposed: 25 live events, 20,000 subscriptions, 500 events/s).

### P11.3 Database recovery
- Restore drill meets RPO ≤ 5 minutes and RTO ≤ 60 minutes (proposed targets).

### P11.4 Monitoring
- Business signals too: approvals waiting, acknowledgments outstanding, failed notifications.

### P11.5 Environments
- Until hosting is chosen, the Docker stack is the interim staging (D-021).

## Exit criteria

- [ ] FSD T19, T20, T29, T35 and T36 pass.
- [ ] The restore drill meets the RPO and RTO targets.
- [ ] No open critical or high vulnerabilities.
- [ ] A named GO decision is recorded for the exact build.

## Frontend unlocked

The four Organizer pages are cleared for real users.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
