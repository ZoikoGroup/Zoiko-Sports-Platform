# D-042 — What the audit trail stores

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | 2026-11-26 |
| Decided by | Engineering |
| Phase | P3 |
| Company reference | GS8, D09 |

## Context

The documents list the audit fields (FSD §13) but not how to treat personal data, failed sign-ins or tamper evidence.

## Decision

Identifiers only: user and organization public UUIDs, role codes, target IDs, the correlation ID and small non-personal details. No emails, names, IP addresses, tokens or passwords. A failed sign-in records the targeted account's ID when it exists, nothing otherwise. UPDATE and DELETE are blocked by a database trigger; tamper evidence (hash chain) and retention come with P11.

## Consequences

`backend/audit/`; `backend/accounts/signals.py`.
