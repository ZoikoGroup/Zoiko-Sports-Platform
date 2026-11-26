# D-041 — Event contracts: naming, versioning and the public events module

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | P4 |
| Company reference | — |

## Context

Publishing and consuming modules need a stable contract, and consumers must be able to import the event types they subscribe to.

## Decision

Each module declares its events in `events.py` (`thing.past_tense`, a version, declared payload fields). Adding an optional field is compatible; anything else is a new version published alongside the old one. Payloads carry IDs and codes, never personal data. `events` joins `services` and `selectors` as a module's public interface in the boundary rule. The catalogue is generated and checked in CI.

## Consequences

`backend/platform_core/events.py`, `backend/platform_core/boundaries.py`, `backend/docs/contracts/events.md`.
