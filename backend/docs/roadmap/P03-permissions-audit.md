# P3 — Permissions and audit trail

| Phase | Status | Owner | Needs | Decisions | Unlocks |
|---|---|---|---|---|---|
| P3 | ⬜ Pending | A | P2 | GP1 role catalogue | Secures every later endpoint |

**Objective:** one permission engine and one tamper-resistant audit trail that every later module plugs into.

**Layer:** L2. **Track:** domain (A). **Runs in parallel with:** P4 (no shared tables). P5 needs both.

**Entry criteria:** P2 merged to `main`.

**Company decision:** GP1, the role catalogue and permission codes. Until it arrives, seed the roles named in the documents (competition director, organizer coordinator, venue manager, club coordinator, organization access manager) and record that assumption as a new decision file when P3 starts.

**Source requirements:** FSD §11 permission matrix, HO §09 access formula, RBAC §03 and A01–A16, FSD T17/T18; gaps GP1, GP2, GS8.

## Work packages (in order)

| ID | Work package | Status | Owner | Depends on | PR / commit |
|---|---|---|---|---|---|
| P3.1 | Role, permission and participation-profile tables (roles as data) | ⬜ Pending | A | P2 | |
| P3.2 | Policy engine: "may this actor do this to that?" | ⬜ Pending | A | P3.1 | |
| P3.3 | Scoped queries: lists, counts, search and exports start from visible rows | ⬜ Pending | A | P3.2 | |
| P3.4 | Response rule: hidden → 404, visible but forbidden → 403 | ⬜ Pending | A | P3.2 | |
| P3.5 | Allowed actions listed on each returned record | ⬜ Pending | A | P3.2 | |
| P3.6 | Deny by default: the build fails if an endpoint has no permission rule | ⬜ Pending | A | P3.2 | |
| P3.7 | Append-only audit trail (database-enforced) | ⬜ Pending | A | P3.1 | |
| P3.8 | Permission-matrix test harness on the golden event (adds Club B and uninvited Club C) | ⬜ Pending | A | P3.2–P3.6 | |
| P3.9 | Django `/admin/` limited to Zoiko staff | ⬜ Pending | A | — | |

### P3.1 Role and permission tables
- Planned code: new module `backend/access/` (`startapp --template=platform_core/app_template`): `Role`, `Permission`, `RolePermission`, `ParticipationProfile`.
- Changes `organizations.Membership.role` (free text today) into a link to `Role`. This is a shared table, so add the new column, fill it, then remove the old one (see handover.md).
- Acceptance: roles and permissions are rows, not code; the seed catalogue loads in a data migration.

### P3.2 Policy engine
- Planned code: `backend/access/policies.py`, `backend/access/selectors.py`.
- Checks in order: active membership (P2) → event participation (hook for P5) → role grants the permission → visible fields → later, data rights.
- Acceptance: every branch tested; the engine is the only place permission decisions are made.

### P3.3 Scoped queries
- Every selector starts from "rows this actor may see", so counts, lists, search and exports can never disagree.

### P3.4 404 versus 403
- A resource the actor may not see returns 404 (its existence is not revealed); a visible resource with a forbidden action returns 403.

### P3.5 Allowed actions
- Each returned record carries the actions the current user may perform. The frontend already expects this on fixtures (`frontend/src/features/organizer/api/types.ts`).

### P3.6 Deny by default
- A system check (like `platform_core.checks`) fails when any API view lacks an explicit permission rule.

### P3.7 Audit trail
- Planned code: new module `backend/audit/`.
- Records actor, acting organization, role at the time, action, target, before/after version, outcome, correlation ID (`platform_core.request_context`) and time.
- Update and delete are blocked in the database (trigger or rule), not only in code.
- Back-fills the P2 gap: sign-in, sign-out, failed sign-in, context switch and invitation events.

### P3.8 Permission-matrix harness
- Extends the golden fixture ([golden-event.md](../golden-event.md)) with Club B and the uninvited Club C, and tests every role against every endpoint, including denials.
- Every new endpoint in later phases must be registered here, or the harness fails.

### P3.9 Django admin restricted
- `config/urls.py` exposes `/admin/` today. Limit it to staff accounts on a restricted path or network; it is not the customer-facing Internal Administration product (P12.6).

## Exit criteria

- [ ] Every endpoint is covered by the permission matrix.
- [ ] 100% of sign-in, sign-out, failed sign-in, context switch and invitation events are audited.
- [ ] Audit rows cannot be updated or deleted (proved by a test against the database).
- [ ] Club C gets nothing on any path.

## Frontend unlocked

None new: this secures everything that follows. The workspace shell keeps working unchanged.

## Acceptance evidence

(Filled when the phase is accepted: CI run, test counts, stack check.)

## Progress log

(One line per merged pull request: date · ID · PR · what changed · what's next.)
