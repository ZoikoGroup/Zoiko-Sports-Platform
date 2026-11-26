# P6 — Fixtures, schedule revisions and approvals

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P6 | ⬜ Pending | A | P5 | K4, D08 and 4 more | Fixtures & Schedule page |

**Objective:** the core promise: who proposed a change, who approved it, and which version is current.

**Layer:** L4. **Track:** domain (A). Fixtures belong to events (P5 tables), so P5 and P6 stay in order with the same owner.

**Entry criteria:** P5 merged.

**Company decisions needed before starting:**
- Schedule states (K4: the documents disagree).
- Approval authority and separation of duties (D08).
- Whether a fixture can have only one open proposal.
- What "discard" does to a fixture that was never published.
- Whether home and away teams are clubs or free text.
- Conflict detection rules. Until they are defined, no conflict detector is built.

**Source requirements:** HO §06 and §08 (revision fields, worked request), FSD T09, T10, T11, T26.

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P6.1 | Tables: fixture, schedule revision, change proposal, approval request, approval decision | ⬜ Pending | A | P5 | |
| P6.2 | Services: create, propose, request approval, approve and publish, discard | ⬜ Pending | A | P6.1 | |
| P6.3 | Version protection: stale publish → 409; published revisions immutable in the database | ⬜ Pending | A | P6.2 | |
| P6.4 | Allowed actions per fixture; recipient preview from participating organizations | ⬜ Pending | A | P6.2, P3.5 | |
| P6.5 | Calendar and summary queries; Fixtures & Schedule screen endpoint | ⬜ Pending | A | P6.4 | |

### P6.1 Tables
- Planned code: new modules `backend/scheduling/` (Fixture, ScheduleRevision, ChangeProposal) and `backend/approvals/` (ApprovalRequest, ApprovalDecision with the approver's role at the time).
- **First pull request of P6:** the event formats in `scheduling/events.py` (for example `fixture.schedule_published.v1`), so the platform track can build notifications against them (P7).

### P6.2 Services
- Approve and publish is one transaction: decision row, new revision row, fixture's current version, audit entry, outbox event.

### P6.3 Version protection
- Two simultaneous approvals: exactly one success and one 409. Revisions cannot be updated (database-enforced).

### P6.4 Allowed actions and recipients
- Each fixture lists the actions the current user may take; the drawer's recipient preview comes from current participations.

### P6.5 Screen endpoint
- `GET /api/v1/organizer/fixtures/`; planned location `backend/workspaces/organizer/fixtures.py`.
- Connect the page: `fixtures`, `createFixture`, `proposeFixtureChange`, `requestFixtureApproval`, `publishFixtureChange`, `discardFixtureChange` in `endpoints.ts`.

## Exit criteria

- [ ] FSD T09, T10, T11 and T26 (time zones and daylight saving) pass.
- [ ] Two simultaneous approvals produce exactly one success and one 409.
- [ ] An unauthorized approval returns 403 even when the request is hand-crafted.
- [ ] Version 1 is still retrievable after version 2 is published.

## Frontend unlocked

Fixtures & Schedule: list, calendar, details drawer, propose / approve / publish / discard, create fixture.

## Acceptance evidence

(Filled when the phase is accepted.)

## Progress log

(One line per merged pull request.)
