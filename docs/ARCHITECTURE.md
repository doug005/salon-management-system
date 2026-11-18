> Historical single-salon documentation. The current controlling role/ownership architecture is [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md), with current endpoints in [MIGRATION_API.md](MIGRATION_API.md). Owner/staff permissions and shared financial access described below no longer apply. Existing deployment preparation remains unverified; consult PROGRESS.md before use.

# Architecture and developer guide

## Components

`client/src/main.jsx` preserves the public design and routing. `state.jsx` supplies business settings and auth state; `api.js` manages an in-memory access token with a shared refresh request; `operations.jsx` contains functional management, booking, customer and reporting views. CSS remains Tailwind v4 plus the established custom visual system.

`client/scripts/build.mjs` bundles React with esbuild and compiles Tailwind through its CLI. Only explicit public build configuration is embedded. `dev.mjs` serves SPA history routes on 3000 and proxies `/api` to 4000. There is no Vite dependency or configuration.

The API separates schemas (`models.js`), request validation (`validation.js`), auth/session mechanics (`auth.js`), transactional business operations (`business.js`), notification delivery (`notifications.js`) and routes (`app.js`). `index.js` connects once and starts maintenance every 30 seconds. The local demonstration launcher creates a Mongo replica set, safely reconfigures its single loopback member address on persistent restarts, and seeds only synthetic records. Production must use an authorised Atlas replica set with working transactions.

## Data model

| Collection/model | Key fields and guarantees |
| --- | --- |
| User | Unique normalised email; bcrypt password hidden by default; role, active, tokenVersion; staff weekday/work-hour schedule and verifier permission |
| Session | User, unique hashed refresh token, absolute seven-day expiry; TTL cleanup; access validates live session and user version |
| Provision | Unique `initial-owner` marker; transactionally guards one-time owner creation |
| Service | Name, description, 15-minute-multiple duration, integer price, HTTPS image URL, active flag |
| Appointment | Unique random reference; customer/staff/service refs; immutable service name/duration/price/fee/total/policy snapshots; starts/ends, status, hold expiry, revision |
| Slot | Unique `(staff, minute)` per occupied quarter hour; appointment reference; never expire individual claims independently |
| Payment | Unique `(method, reference)`; appointment, purpose, integer amount, status, recorder/verifier/times and evidence/review note |
| Expense | Category, description, integer amount, incurredAt, recorder |
| BusinessSettings | Unique business singleton; public identity/contact/hours/closure dates, LSL, Africa/Maseru, fee, policy and version, hold/change window |
| Notification | Recipient, event title/text, delivery status, attempt count, worker lock, safe error text |
| Audit | Actor (optional for system expiry), action, entity/id, details and timestamps; no mutation routes |

Mongoose strict mode rejects unknown schema fields. Request bodies use strict Zod allowlists. APIs control recorder/verifier/role/status/snapshot fields. Mongo indexes are required, not optional: run the explicit index provisioning script before production. There are no delete APIs that could erase historical accounting records.

## Session/security strategy

Access JWT: HS256, issuer `salon-api`, audience `salon-client`, 15 minutes, subject/version/session id. Refresh secret: random 48-byte token, hashed in database, HttpOnly SameSite=Strict cookie scoped to `/api/auth`, Secure in production, absolute seven-day lifetime. Refresh rotates atomically and rejects replay of the previous token. The browser stores access tokens only in memory. Logout deletes the session; password change increments user version and deletes all sessions. Deactivation is checked on every protected request. Cookies are only authentication on refresh/logout, both requiring the exact configured Origin; operational APIs require bearer tokens.

A same-origin proxy is required in hosted use to keep refresh cookies first-party. Public registration never accepts roles. Owner bootstrap requires an environment setup token and the singleton marker. Owners manage only staff, not arbitrary privileged roles. Staff can record payments; only owner or explicit verifier permission permits independent verification. Customer data is scoped to the current customer; staff appointment management is scoped to assigned visits.

## Booking and payments

1. Read active service/staff and settings; verify future quarter-hour start, horizon, hours, closures and policy acceptance/version.
2. In a transaction, insert appointment snapshots and **all** occupied staff slot claims. The unique index arbitrates concurrent overlap attempts; a duplicate transaction aborts completely.
3. A hold is awaiting payment; recording a fee changes it to pending confirmation, never confirmed. A matching positive fee amount and unique reference are required.
4. Only an authorised manual verification transaction can change a payment to paid and a fee-backed booking to confirmed. It validates hold state and outstanding balance, writes the appointment to serialise competing income operations, records audit and queues notification in the same transaction.
5. Repeated verification is rejected; only paid records contribute income. Balance payments are separate receipts, so the deducted fee is not counted twice.
6. Expiry transaction cancels unpaid holds, expires pending payment records, releases all claims and queues a notice. Availability and writes run expiry maintenance too. Confirmed bookings have no unpaid hold expiry.
7. Reschedule claims are replaced transactionally; a conflicting target rolls back the original claims. Cancellation releases claims and preserves received money, since refunds are external and not silently invented.
8. Completion/no-show requires an already confirmed appointment whose end has passed. Closed appointments reject further state changes.

Zero booking fees are intentionally disallowed by the settings API because confirmation requires an independently verified positive booking payment. Services use 15-minute units. One staff member is the constrained resource; multi-resource rooms/chairs, split shifts and per-service staff skills are future extensions.

## Finance and notifications

Received income is the sum of `paid` records by verification date, not booking value or evidence. Expenses use incurred date, booked values use appointment date, and outstanding balances subtract lifetime receipts. Cancellation does not fabricate a refund. Revenue minus recorded expenses is a basic cash summary, not statutory tax accounting.

Notifications are queued with business transactions; delivery happens after commit. Safe mode marks records simulated without contacting anyone. SMTP errors do not roll back valid bookings. Worker claims are atomic, failures capped at three attempts, and the owner can explicitly retry failures. Delivery is at-least-once: a process crash after SMTP acceptance but before recording success can duplicate an email; exactly-once SMTP cannot be guaranteed. Logs must be monitored and live delivery approved before enabling it.

## Development and extensions

Run `npm run check`, `npm run build`, and, with synthetic servers running, `npm run test:e2e`. Integration tests start isolated replica sets, build indexes and cleanly stop them. Keep important tests around transaction boundaries rather than relying on UI state. Add new models to index provisioning and integration initialisation. Do not replace conflict protection with a find-then-insert overlap check.

Images are owner-configured HTTPS URLs; no upload endpoint exists. A future storage integration must use authorised account configuration, size/MIME restrictions, image decoding/re-encoding, generated names and private receipt access. Never accept arbitrary file-system paths or treat screenshots as proof of funds.
