# competitions

**Purpose:** competitions and their events. Today a provisional subset of P5.2, built for venue
readiness on the defaults of [D-047](../docs/decisions/D-047-venue-readiness-defaults.md).
**Built in:** P5.2, started for P12.1 ([roadmap](../docs/roadmap/P05-competitions.md)). **Owner:** Developer A.

## Models

| Model | Notes |
|---|---|
| `Competition` | `organization` (the organizer that owns it), `name`, `sport` (code), `status` (planned, active, completed, cancelled), `version`. Index (organization, status) |
| `Event` | `competition`, `name`, `venue` (a venue organization), `city`, `country` (ISO 3166-1, upper case), `region` (six regions), `time_zone` (IANA), `starts_at` (UTC), `status` (scheduled, completed, cancelled), `version`. Index (competition, starts_at) |

CHECK constraints guard status, region, country and sport values (D-046). Both models expose
`owner_organization_id` (the organizer) for the policy engine.

## Public interface (other modules may use)

| Function | Kind | What it does |
|---|---|---|
| `services.create_competition(organization, name, sport)` | write | Only an active organizer; audited; publishes `competition.created` |
| `services.schedule_event(competition, name, venue, city, country, region, time_zone, starts_at)` | write | Only an active venue hosts; validates country, region, IANA zone and an aware start; audited; publishes `event.scheduled` |
| `services.ensure_competition` / `services.ensure_event` | write | Create if missing (demo data and fixtures) |
| `selectors.event_names(ids)` | read | Display names by public UUID (event consumers) |

## Endpoints

None yet (P5.4–P5.7).

## Events, permissions, audit

- **Events published:** `competition.created.v1` (competition_id, organization_id, sport),
  `event.scheduled.v1` (event_id, competition_id, organization_id, venue_id, starts_at). Scope: the organizer.
- **Permissions:** none yet; `competition.*` arrives with the endpoints.
- **Audit:** `competition.created`, `event.scheduled`.

## Tests

| File | Covers |
|---|---|
| `tests/test_competitions.py` | Creation rules, validation field by field, UTC storage, database constraints, audit and events, ensure-once |

## Known gaps

- Event participation (invited clubs), lifecycle transitions as data, HTTP endpoints and the
  participation gate: the rest of P5, after GD3 and K3.
