# D-031 — Remembered sessions last 14 days

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-25 |
| Decided by | Engineering |
| Phase | P2 |
| Company reference | GS3 |

## Context

Session lifetime values are undecided (GS3).

## Decision

14 days when "remember me" is ticked, configurable 1–90 (`SESSION_REMEMBER_DAYS`); otherwise the session ends with the browser.

## Consequences

`backend/config/settings.py`.
