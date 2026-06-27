# ADR-001 — One codebase, not two apps

**Status:** Accepted · 2026-06-27

## Context
Free and Pro could ship as (a) two repos / two store listings, or (b) one
codebase gated at runtime.

## Decision
(b) **One codebase**, controlled by the entitlement system.

## Rationale
- One bug fix covers Free and Pro; no drift between two trees.
- Free → Pro upgrade needs no re-download.
- ~80% of feature code is shared.

## Consequences
- Slightly larger JS bundle (acceptable — no extra native code).
- Requires a solid entitlement layer (see ADR-002, ADR-004).
