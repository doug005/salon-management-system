# Offline support — phase one

## Implemented scope

- Installable app manifest and the existing service worker are retained.
- Static app shell, root document, CSS/JS, icons, manifest and a standalone offline fallback are cached same-origin.
- The service worker allowlists public professional lists/profiles, public service listings, public advertisements, and public service/profile images. It caches only successful JSON/image responses and bounds the public cache to 100 entries.
- Requests with an Authorization header are never cached. Customer/private profile, appointments, payments, notification, admin, professional, and mutation APIs are not allowlisted. Refresh cookies and tokens are never written to Cache Storage or IndexedDB.
- Public browser requests are sent without the in-memory bearer token. This permits public catalog caching while avoiding storage of credentialed response data.
- A persistent online/offline banner is shown on public pages and workspaces. When offline, booking, appointment changes, manual payment recording, and payment verification are disabled and guarded in their handlers. They are never queued or silently retried.
- Navigating directly while offline uses the localized preference, when previously saved, in the standalone static fallback. App-shell routes loaded within the app show the same status banner and disable server-required writes.

## Limits

- The public catalogue can be cached only after it has loaded successfully online once. A cache entry may become stale; the UI identifies it only as cached public information and does not reserve appointments offline.
- The public cache can be visible on a shared device. It contains only already-public business/service information, not customer data or financial records. The cache is size-bounded, but it does not yet have explicit user-controlled purge tooling.
- A language preference uses localStorage; it is not an authentication secret or sensitive record.
- Full offline synchronization is **not implemented**. It would require explicit informed opt-in, a shared-device data threat model, local encryption/unlock policy if private data is justified, expiry/revocation, foreground-only reauthorization, conflict detection/slot reservation, server audit logging, idempotency, synchronization retry semantics, connectivity tests, and participant consent. No booking or payment may become confirmed offline.

## Verification

The Playwright workflow tests English/Sesotho persistence without wiping an in-progress registration form and public-service cache/offline fallback behavior. Security review must continue to verify that no `/api/auth`, `/api/appointments`, `/api/payments`, `/api/professional`, `/api/admin`, `/api/notifications`, or other private response is cacheable.
