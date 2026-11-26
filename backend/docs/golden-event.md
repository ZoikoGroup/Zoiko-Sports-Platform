# The golden event

One fictional scenario, taken from the project documents (GAP §16, HO §07), that every phase
tests against. All names are synthetic.

## Organizations and people

| Organization | Kind | In the seed today | Role in the scenario |
|---|---|---|---|
| Riverside Invitational | Organizer | ✅ | Runs the competition |
| Northfield Arena | Venue | ✅ | Hosts it; shares readiness checks |
| Club A | Club | ✅ | Invited participant |
| Club B | Club | ❌ added in P3.8 | Invited participant |
| Club C | Club | ❌ added in P3.8 | **Not invited**: must see nothing, ever |

The demo seed (`backend/accounts/management/commands/seed_demo.py`, password from
`ZS_DEMO_PASSWORD`, never printed) creates these accounts:

| Account | Memberships |
|---|---|
| `demo@zoikosports.test` | Riverside (competition_director), Northfield (venue_manager), Club A (club_coordinator), plus Individual |
| `organizer@zoikosports.test` | Riverside (competition_director) |
| `venue@zoikosports.test` | Northfield (venue_manager) |
| `club@zoikosports.test` | Club A (club_coordinator) |
| `individual@zoikosports.test` | Individual only |

## The story each phase adds to

| Phase | What the scenario checks |
|---|---|
| P2 ✅ | The multi-workspace account chooses; switching works without sign-out; a removed member is locked out on the next request |
| P3 | Every role × every endpoint, including denials; Club C gets nothing |
| P5 | Riverside creates a competition and invites Northfield and Clubs A and B; Club C gets 404 on every path |
| P6 | A kick-off moves from 12:15 to 12:25: proposed, approved, published as version 2; version 1 stays readable |
| P7 | Clubs A and B are notified; delivered is not acknowledged; a club revoked after queueing gets nothing |
| P8 | The approval and the outstanding acknowledgments appear in the Action Centre; totals equal lists |
| P12.1 | Northfield's 16 readiness checks: 14 shared, 2 not shared |
| P12.2 | The turnstile incident on event day: opened, triaged, resolved |

## Rules for seed data

- Seed only through the owning module's `services` (the boundary rule applies to the seed
  command too), so seeded actions produce the same audit entries and events as real ones.
- No real people, organizations or passwords; nothing in the seed is printed except email
  addresses.
- See D-036 for why the seed is still a single command.
