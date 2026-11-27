# The golden event

One fictional scenario, taken from the project documents (GAP §16, HO §07), that every phase
tests against. All names are synthetic.

## Organizations and people

| Organization | Kind | In the seed today | Role in the scenario |
|---|---|---|---|
| Riverside Invitational | Organizer | ✅ | Runs the competition |
| Northfield Arena | Venue | ✅ | Hosts it; shares 14 of its 16 readiness checks (P12.1) |
| Club A | Club | ✅ | Invited participant |
| Club B | Club | ✅ (P3.8) | Invited participant |
| Club C | Club | ✅ (P3.8) | **Not invited**: must see nothing, ever |

The demo seed (`backend/accounts/management/commands/seed_demo.py`, password from
`ZS_DEMO_PASSWORD`, never printed) creates these accounts:

| Account | Memberships |
|---|---|
| `demo@zoikosports.test` | Riverside (competition_director), Northfield (venue_manager), Club A (club_coordinator), plus Individual |
| `organizer@zoikosports.test` | Riverside (competition_director) |
| `venue@zoikosports.test` | Northfield (venue_manager) |
| `club@zoikosports.test` | Club A (club_coordinator) |
| `clubb@zoikosports.test` | Club B (club_coordinator) |
| `clubc@zoikosports.test` | Club C (club_coordinator), never invited to anything |
| `individual@zoikosports.test` | Individual only |

## The story each phase adds to

| Phase | What the scenario checks |
|---|---|
| P2 ✅ | The multi-workspace account chooses; switching works without sign-out; a removed member is locked out on the next request |
| P3 ✅ | Every role × every endpoint, including denials; Club C gets nothing (`access/tests/test_permission_matrix.py`) |
| P5 | Riverside creates a competition and invites Northfield and Clubs A and B; Club C gets 404 on every path |
| P6 | A kick-off moves from 12:15 to 12:25: proposed, approved, published as version 2; version 1 stays readable |
| P7 | Clubs A and B are notified; delivered is not acknowledged; a club revoked after queueing gets nothing |
| P8 | The approval and the outstanding acknowledgments appear in the Action Centre; totals equal lists |
| P12.1 ✅ | Northfield's 16 readiness checks: 14 shared, 2 not shared; Riverside sees and counts only the 14 (`readiness/tests/test_readiness.py`) |
| P12.2 | The turnstile incident on event day: opened, triaged, resolved |

## Rules for seed data

- Seed only through the owning module's `services` (the boundary rule applies to the seed
  command too), so seeded actions produce the same audit entries and events as real ones.
- No real people, organizations or passwords; nothing in the seed is printed except email
  addresses.
- See D-036 for why the seed is still a single command.
- The seed also creates Riverside's competition at Northfield and four more fictional venues
  (Harbour Point Stadium, Lakeside Park, Southern Cross Ground, Bayfront Arena) so the Venues &
  Readiness page shows every status (`accounts/management/demo_readiness.py`, D-047).
