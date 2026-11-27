# D-044 — Who sees the activity feed

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | P4 |
| Company reference | — |

## Context

The feed needs a visibility rule before events about events (P5) exist.

## Decision

An entry is visible to members of the organization it concerns whose role grants `activity.view` (every seeded role does). From P5, entries about an event are also visible to participating organizations through the participation gate.

## Consequences

`backend/activity/selectors.py`; permission seeded in D-039.
