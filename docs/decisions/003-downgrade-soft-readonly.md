# ADR-003 — Downgrade = soft read-only

**Status:** Accepted (policy) · Enforcement: deferred · 2026-06-27

## Context
A Pro vendor with 50 Mini Shop products lets the subscription lapse. What happens
to data created over the Free limit?

## Decision
**Soft read-only.** Keep all data visible; block create/edit of tier-gated data
until the user deletes down to the Free limit or re-upgrades. Never auto-delete
or auto-archive.

## Rationale
- Hard block / data loss → churn + broken trust; the data is the vendor's real inventory.
- Auto-archive without consent → trust hit.
- Soft read-only respects the user and still doesn't give Pro away free.

## Consequences
- A `readOnly` state is needed in tier-gated screens (surfaced by `useEntitlement`).
- A clear banner: "Pro หมดอายุ — แก้ไขไม่ได้จนกว่าจะอัปเกรด หรือลดข้อมูลให้ไม่เกินสิทธิ์ฟรี".
- Exported files always remain accessible (they're on the device).
- **3-day grace** before enforcement.

## Status note
`unifiedEntitlementService.readOnlyMode()` returns `false` until subscription
**expiry** is stored locally. The interface is in place; do not advertise the
behaviour as working until expiry data exists.
