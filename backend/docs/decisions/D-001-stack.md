# D-001 — Technology stack: Python, Django 5.2, DRF, PostgreSQL 16

| Field | Value |
|---|---|
| Status | ✅ Confirmed |
| Date | 2026-11-20 |
| Decided by | Project lead |
| Phase | P0 |
| Company reference | — |

## Context

The backend needed a confirmed stack before any code. Recorded in the company decision log (Claude Doc) on that date; copied here in Stage 0.

## Decision

Python with Django 5.2, Django REST Framework and PostgreSQL 16.

## Consequences

Every module is a Django app; see `backend/requirements.in`.
