> Historical single-salon documentation. The current controlling role/ownership architecture is [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md), with current endpoints in [MIGRATION_API.md](MIGRATION_API.md). Owner/staff permissions and shared financial access described below no longer apply. Existing deployment preparation remains unverified; consult PROGRESS.md before use.

# API reference

Base `/api`. JSON bodies; protected endpoints need `Authorization: Bearer <access-token>`. Errors return `{message, errors?}`; 400 validation, 401 authentication, 403 permission/origin, 404 missing record, 409 conflict. Lists return `{items,total,page,limit}` and support `page`, `limit` (1–100), `search`. IDs are 24-character Mongo ObjectIds. Money fields are **integer lisente**. Dates are ISO UTC/offset timestamps; availability date is YYYY-MM-DD in Africa/Maseru.

| Method/path | Permission | Body/response |
| --- | --- | --- |
| GET `/health` | Public | Database-aware status, timezone, currency, email mode; 503 if unavailable |
| POST `/auth/register` | Public | name, email, password (12+ characters, <=72 UTF-8 bytes), optional phone; customer only |
| POST `/auth/login` | Public | email, password; returns public user and access token; sets refresh cookie |
| POST `/auth/refresh` | Exact Origin + cookie | Rotates cookie and returns session |
| POST `/auth/logout` | Exact Origin + cookie | Revokes session and clears cookie |
| POST `/auth/provision-owner` | Exact Origin + setup token | Registration fields plus setupToken; one-time, disabled if token env absent |
| GET `/auth/me` | Authenticated | Current public user |
| PATCH `/profile` | Authenticated | name, phone |
| POST `/profile/password` | Authenticated | currentPassword, password; revokes all sessions |
| GET `/public/settings` | Public | Business details/policy/settings; no SMTP or auth secrets |
| GET `/public/services` | Public | Active service list |
| GET `/public/staff` | Public | Active schedulable name/id/work hours only; no emails |
| GET `/public/availability` | Public | Query service, staff, date; `{slots:[ISO timestamp]}` |
| GET `/appointments` | Role scoped | Optional status filter; customer owns, staff assigned, owner all |
| POST `/appointments` | Authenticated | service, staff, startsAt, acceptPolicy:true, policyVersion, optional notes; team additionally supplies customer |
| POST `/appointments/:id/action` | Owner/assigned staff/own customer | `{action:cancel, reason?}`, `{action:reschedule, startsAt}`, `{action:complete}` or `{action:no_show}`; customers cannot complete/no-show |
| GET `/payments` | Authenticated | Customer sees own bookings only; team can inspect payment records; status filter |
| POST `/payments` | Team | appointment, amountLisente, method, reference, kind, optional evidenceUrl |
| POST `/payments/:id/review` | Owner or verifier staff | action: verify/reject/request_info; note (3–500 chars) |
| GET `/admin/overview` | Team | Appointment/customer counts, pending confirmations, upcoming visits |
| GET/POST `/customers` | Team | List/lookup; create with registration fields, always customer |
| GET/POST `/staff` | Owner | List/create staff; fields name,email,password,weekdays,workStart,workEnd,canVerifyPayments |
| PATCH `/staff/:id` | Owner | name, active, weekdays, workStart, workEnd, canVerifyPayments; no role escalation |
| GET `/services` | Team | Includes inactive services |
| POST `/services` | Owner | name, description, durationMinutes (15–480, multiple of 15), priceLisente, imageUrl, active |
| PATCH `/services/:id` | Owner | Same complete editable service fields; historical snapshots preserved |
| GET/PUT `/settings` | Owner | Complete settings payload below; policy version increments server-side |
| GET/POST `/expenses` | Owner | category, description, amountLisente, incurredAt |
| GET `/reports` | Owner | Optional from/to local dates; received/expense/profit/booked value, fee/balance income, expense categories, daily receipts, outstanding and popularity |
| GET `/notifications` | Authenticated | Owner sees all; others see own logs |
| POST `/notifications/:id/retry` | Owner | Only failed records may retry |
| GET `/audit` | Owner | Searchable paginated audit history |

Payment methods: `cash`, `bank_transfer`, `mobile_money_manual`. Purposes: `booking_fee`, `balance`. Statuses: `unpaid`, `awaiting_verification`, `paid`, `failed`, `cancelled`, `expired`, `rejected`. New records enter awaiting_verification; some schema statuses are reserved for future reconciliation, not user-settable. References are unique per method; choose the actual external reference or a unique cash receipt reference. No API contacts a payment provider.

Appointment statuses: `awaiting_payment`, `pending_confirmation`, `confirmed`, `completed`, `cancelled`, `no_show`. Expired holds are cancelled with `expired:true`; expiry is not a seventh appointment state. Payment review accepts only open awaiting-verification records. Funds received for an expired/cancelled booking require human reconciliation outside this application; they cannot silently resurrect the reservation.

Settings body:

```json
{
  "salonName": "Demonstration Salon",
  "description": "Synthetic business details",
  "demo": true,
  "whatsappNumber": "",
  "phone": "",
  "email": "",
  "address": "",
  "openingHours": {"1":"09:00-17:00","2":"09:00-17:00"},
  "closedDates": [],
  "bookingFeeLisente": 5000,
  "feeDeducted": true,
  "holdMinutes": 60,
  "policyText": "Demonstration policy; replace with owner-approved terms before launch.",
  "changeNoticeHours": 24
}
```

Opening days use 0 Sunday to 6 Saturday; omitted days are closed. `whatsappNumber` is international digits without `+`, or blank. Settings are publicly readable business information; do not put secrets or private notes there. Image/evidence URLs must use HTTPS; evidence is optional and never verified automatically.
