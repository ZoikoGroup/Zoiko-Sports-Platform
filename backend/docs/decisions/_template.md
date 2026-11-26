# D-nnn — Short decision title

<!--
Copy this file to D-<next free number>-<short-title>.md (lowercase, hyphens), fill it in,
then run `python manage.py check_tracker --write` from backend/ to refresh the index.
If two pull requests pick the same number, CI fails on the second: renumber it.
-->

| Field | Value |
|---|---|
| Status | 🟡 Assumed |
| Date | YYYY-MM-DD |
| Decided by | Role (Product, Security, Engineering, Project lead…) |
| Phase | Pn |
| Company reference | Gap or conflict ID from the project documents (GP1, K3…), or — |

Status is one of: ✅ Confirmed · 🟡 Assumed (a default used in code until someone decides) ·
📝 Proposed (waiting for approval) · ♻ Superseded by D-nnn.

## Context

What question had to be answered, and why now.

## Decision

What was chosen. One or two sentences.

## Consequences

Where the code depends on it (file paths), what changes if it is reversed, and any follow-up.
