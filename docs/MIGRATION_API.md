# Current API — role/ownership milestone

All protected APIs require an access JWT backed by a live session/current supported database role. Public registration rejects privileged fields and always creates a customer. Refresh/logout retain rotating HttpOnly cookie and exact-origin protections. Private inputs are strict allowlists; an ownership field in a service/payment/expense/profile body is rejected, not trusted.

| Route | Authority and scope |
| --- | --- |
| POST `/api/auth/register`, `/login`, `/refresh`, `/logout` | Customer self-registration; current-role login/session handling |
| POST `/api/auth/provision-admin` | One-time private ADMIN_SETUP_TOKEN, exact origin, unique initial-admin marker |
| POST `/api/auth/provision-owner` | 410, disabled; never maps old users |
| GET `/api/auth/me`, PATCH `/profile`, POST `/profile/password` | Current user's identity/name/phone/password; no role/ownership editing |
| GET `/api/admin/overview` | Admin account counts only; no bookings or finance |
| GET `/api/admin/accounts` | Admin account-management projection; paginated/searchable; no business/finance joins |
| POST `/api/admin/professionals` | Admin only; name/email/password/optional phone; server assigns role and creator, creates unpublished profile |
| PATCH `/api/admin/accounts/:id` | Admin activation/deactivation only; token version changes revoke access and refresh authority, including after reactivation; cannot deactivate current admin session |
| GET/PUT `/api/admin/settings` | Admin shared platform name/description/demo; cannot set professional fees or read business reports |
| GET `/api/public/settings` | Shared platform data only |
| GET `/api/public/professionals`, `/:id` | Published profiles of active professionals only; public field allowlist |
| GET `/api/public/services?professional=id` | Active services owned by published/active professionals; optional owner filter |
| GET `/api/public/availability?service=id&professional=id&date=YYYY-MM-DD` | Validates service owner matches published professional |
| GET `/api/professional/overview` | Own counts, pending confirmations and upcoming bookings |
| GET/PUT `/api/professional/settings` | Own business profile, published flag, hours/closures, contact/WhatsApp, fee/deduction/hold/policy/version; GET includes own photo URL |
| GET/PUT `/api/professional/availability` | Own weekday/work-start/work-end schedule |
| GET `/api/professional/availability/slots?service=id&date=...` | Own service only, including unpublished business; owner derived from session |
| GET/POST `/api/services`, PATCH `/api/services/:id` | Professional only; own records and server-assigned ownership |
| PUT/DELETE `/api/professional/profile/photo`; `/api/professional/services/:id/image` | Professional-only 5 MiB PNG/JPEG/WebP upload/removal, normalized to WebP; service/profile ownership from session. Public bytes use checked `/api/public/professionals/:id/photo` and `/api/public/services/:id/image` routes |
| GET/POST `/api/customers` | Professional only; own ProfessionalCustomer relationships, not global customer directory |
| GET/POST `/api/appointments`, POST `/:id/action` | Customer own bookings or professional own business; no admin. Booking body now requires `professional`, not `staff` |
| GET `/api/payments` | Professional owned valid appointment/payment pairs or customer own valid receipts; no admin |
| POST `/api/payments`, POST `/:id/review` | Owning professional only, including manual verify/reject/request_info; no admin or cross-professional access |
| GET/POST `/api/expenses`, GET `/api/reports` | Professional own business only; no admin. Financial exports inherit report scope |
| GET `/api/audit` | Admin platform events without business ownership; professional own business events; no customer |
| GET `/api/notifications` | Own scoped notifications; professionals own business events, admin own platform/personal, customer own personal/business |
| POST `/api/notifications/:id/retry` | Owning professional business delivery failures only |
| `/api/staff`, `/api/settings` | 410 legacy shared management disabled; no compatibility privilege fallback |

Account creation body: `{name,email,password,phone?}`. Professional public profile uses the existing business form field `salonName` as its display name. Editable business settings are the documented prior settings payload plus `published`; professional ownership is never included in an editable body. Service, expense, payment and appointment business fields retain existing validation and manual-money state transitions; the new professional scope is mandatory and server-controlled.

Cross-business record IDs return 404 or role denial without foreign details. Admin financial operations return 403 regardless of any retained legacy verifier flag. Unknown/legacy owner/staff roles return a migration-required 403 on login, refresh or protected access; old documents remain unchanged.

Appointment action accepts reschedule/cancel/start/complete/no_show. Only the owning professional may start a confirmed appointment during its scheduled interval; only an in-progress appointment can be completed before scheduled end; no-show follows the scheduled end. A confirmed booking can be completed after its scheduled end for compatibility. Customers cannot start, complete or mark no-show, and started/in-progress bookings cannot be rescheduled.

Advertisement APIs support image or MP4/WebM video replacement, media removal, public byte-range video playback, and seven-day/three-active rules. See [ADVERTISEMENTS.md](ADVERTISEMENTS.md). Professional-only management replaces the obsolete moderation design. No admin advertisement endpoints exist.
