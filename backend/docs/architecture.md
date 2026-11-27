# Architecture

How the backend is organised, and the rules that keep two developers from stepping on each
other. The platform conventions themselves are in [conventions.md](conventions.md).

## One app, modules inside it

The backend is one Django project (`backend/config/`) made of **modules**: Django apps with the
same internal layout, created from `platform_core/app_template/`.

```
<module>/
  README.md      what the module does and where everything is (required; CI checks)
  models.py      this module's tables only
  services.py    write operations (one transaction each) — public to other modules
  selectors.py   read operations (permission-scoped) — public to other modules
  policies.py    this module's own permission helpers (decisions come from access)
  events.py      the events this module publishes (versioned) — public: the contract with consumers
  api/           HTTP only: serializers, views, urls
  tests/
```

**Boundary rule (enforced by `manage.py check`, so CI):** another module may import only a
module's `services`, `selectors` and `events` (D-041). Never its models, API or anything else. `platform_core` may
be imported by everyone and imports no module. Tests and migrations are exempt.

## Modules today and planned

| Module | Phase | Track | Purpose |
|---|---|---|---|
| `platform_core` | P0–P1 ✅ (+P3/P4 hooks) | shared | Kernel: errors, IDs, versions, idempotency, paging, time, OpenAPI, boundaries, workspace context, authorization hooks, event types, tracker check |
| `accounts` | P2 ✅ | shared | Users, sign-in, sessions, the active workspace context |
| `organizations` | P2 ✅ | A | Organizations, memberships, invitations, context resolution; first event publisher |
| `access`, `audit` | P3 👀 | A | Roles and permissions as data, policy engine; append-only audit trail |
| `outbox`, `activity` | P4 👀 | B | Transactional outbox and worker; permission-scoped activity feed |
| `reference`, `competitions` | P5 (`competitions` started for P12.1, D-047) | A | Sports, countries, regions; competitions, events, participation |
| `scheduling`, `approvals` | P6 | A | Fixtures and schedule revisions; approval requests and decisions |
| `notifications` | P7 | B | Notices, delivery attempts, acknowledgments |
| `workitems` | P8 | B | The Action Centre engine |
| `analytics`, `search` | P9 | B | Overview counters; global search |
| `realtime` | P10 | B | Cache and server push |
| `readiness` | P12.1 👀 | A | Venue readiness: checklists, evidence records, update requests |
| `workspaces` | P12.1 (first page), P5–P9 | page owner | Screen endpoints for the Organizer pages, one file per page; owns no tables |

## How a write flows (P3/P4, in place now)

```
HTTP request
  → accounts.middleware        who is this, and which workspace are they acting for? (P2)
  → <module>.api view          shape and types (serializer)
  → <module>.services.<cmd>    business rules; access.selectors.can decides (P3)
       one transaction:  change rows  +  audit entry (P3)  +  outbox event (P4)
  → response
outbox → worker → consumers   activity feed, notifications, work items, caches (P4, P7–P10)
```

A module never calls another module to "tell" it something. It publishes an event and the
other module consumes it. That is why the domain track (A, which publishes) and the platform
track (B, which consumes) can work in parallel: the contract between them is each module's
`events.py`.

## Where the frontend fits

- The React app talks only to `/api/v1/…`.
- Each Organizer page reads one **screen endpoint** (`/api/v1/organizer/<page>/`) and performs
  actions through **resource endpoints** (`/api/v1/competitions/…`).
- A page goes live only when its phase is accepted: its entries in
  `frontend/src/features/organizer/api/endpoints.ts` are filled in then, and not before.
