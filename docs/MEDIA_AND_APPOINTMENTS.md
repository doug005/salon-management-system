# Business media and appointment workflow

## Professional profile photos

Professionals upload, preview, replace or remove their business profile photo in Settings. PNG/JPEG/WebP uploads are capped at 5 MiB and 20 megapixels, decoded and normalized to metadata-free WebP, and stored outside MongoDB. Storage keys are server-generated. The photo is displayed on public professional cards and profile details only when that professional's account and profile are active/published. Private management derives ownership from the signed-in professional; other roles cannot upload or remove it.

## Service images

Professional service editing supports local computer uploads, preview/replacement/removal. Existing service name, description, duration, price, publication and booking snapshots are unchanged. Public service cards, featured slideshow, service details and profile listings display uploaded images for active services under published professionals. The raw stored image ID is not a storage path; media is served through a checked API route.

## Validation and storage

- Input image type is checked by decoder, not filename; animated images are rejected.
- Upload body limit 5 MiB; image decoder limit 20 megapixels; output max 1600 × 1600 WebP.
- New random media records are staged before writing. A successful write and database transaction attach the asset; failed/stale uploads are retryable cleanup candidates.
- Replacement/removal first detaches/marks the prior media; cleanup checks profile/service references before deletion. Public reads require `ready` state and match professional and media kind.
- Development storage is project-local `.local/business-media/`. Production requires the private S3-compatible configuration described in [deployment](DEPLOYMENT.md); grant `business-media/*` GetObject/PutObject/DeleteObject only and block public access. Storage has not been connected to or live-tested against an external provider.

API operations:

- PUT/DELETE `/api/professional/profile/photo`
- PUT/DELETE `/api/professional/services/:id/image`
- GET `/api/public/professionals/:id/photo`
- GET `/api/public/services/:id/image`

## Appointment workflow

Booking retains its conflict-safe slot reservation, online registered-customer ownership, guest/phone booking, manual payment hold, policy snapshots and cancellation/reschedule checks. Statuses are `awaiting_payment`, `pending_confirmation`, `confirmed`, `in_progress`, `completed`, `cancelled`, and `no_show`.

- A recorded fee stays `pending_confirmation` until the owning professional independently verifies it; verification is never automated.
- The owning professional may start a `confirmed` appointment only during the scheduled interval. Customers and other professionals cannot perform that transition.
- An appointment cannot be rescheduled once its start has passed or it is in progress.
- In-progress appointments may be completed by the owning professional. A confirmed booking can also be completed after its scheduled end for compatibility with existing direct completion workflows.
- A confirmed appointment may be marked no-show only after its scheduled end.
- Closed appointments cannot be reopened; cancellation releases claims and existing manual payment/refund rules remain intact.

The appointment action endpoint remains `POST /api/appointments/:id/action`; server validation is authoritative even when UI controls are hidden by time/status. Full details are in [current API](MIGRATION_API.md).

## Verification

The isolated backend integration suite covers profile/service media authorization, public delivery/removal, video MIME/container checks, replacement, expiry, range requests, appointment start/completion timing, customer prohibition and reschedule rejection. The Playwright suite adds a professional service image preview/upload/public card/removal path. Real-user pilot fieldwork has not occurred; follow [PILOT.md](PILOT.md) before any approved pilot.
