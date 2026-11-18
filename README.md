# Salon Management System — multi-professional migration

## Project overview and objectives

A responsive salon/business platform for Lesotho that lets independent beauty professionals publish services and manage bookings and records while customers discover services and manage appointments. The platform separates admin account/settings work from each professional's private business. Its money workflow records externally arranged payments and requires an authorized professional to verify receipt independently; it does not process payments.

React/React Router/Tailwind/esbuild client; Node/Express/Mongoose backend. **No Vite and no payment gateway.** Money is integer lisente, shown as M; business times use Africa/Maseru with UTC storage.

The verified foundation establishes **admin / professional / customer** roles and professional ownership; milestone 2 adds professional-only advertisements and milestone 3 redesigns all three role workspaces. It supersedes the historical single-salon owner/staff model. See [FINAL_ARCHITECTURE.md](docs/FINAL_ARCHITECTURE.md), [migration plan](docs/MIGRATION_PLAN.md), [current API](docs/MIGRATION_API.md) and [PROGRESS.md](PROGRESS.md). Root [AGENTS.md](AGENTS.md) is the permanent Codex instruction entry point for sessions opened in this project.

## Role boundaries

- Customers self-register and manage their own accounts/bookings/payment status.
- Only admin creates professional accounts. Admin manages platform accounts/settings; advertisements are managed only by their owning professional. Admin **cannot** access private professional appointments, payments, expenses or financial reports and cannot verify payments.
- Professionals manage their own profiles, publication, availability, services, customer relationships, appointments, booking fees/policy, manual payment records/verification, expenses, reports, contacts and business audits.
- Professionals upload and manage secure profile/service images; advertisements support one image or MP4/WebM video at a time, previews/playback, safe replacement/removal, immediate publication, a three-active limit and exact seven-day expiry. See [media and appointment guide](docs/MEDIA_AND_APPOINTMENTS.md) and [advertisement documentation](docs/ADVERTISEMENTS.md).
- Each private query/write/export is professional-scoped. Public profiles/services are explicitly published; shared platform settings contain no professional fee or financial configuration.
- Professionals manage seven-day advertisements at `/professional/advertisements`, with immediate publication, a three-active limit, validated images and retryable expiry cleanup. Public advertisements appear on the homepage and `/professionals/:id`. See [advertisement documentation](docs/ADVERTISEMENTS.md).

## Local application

Node 22.12+ and npm are required. Install project dependencies with `npm ci --cache .npm-cache`. No privileged commands or system settings are used.

`npm run demo` starts the client on **http://localhost:3000** and a separate local synthetic multi-professional database/API on **http://localhost:4000/api/health**. If the existing client is already running, manage only `npm run demo -w server` to avoid conflicting listeners. The launcher disables automatic MongoDB runtime downloads; its project-local MongoDB 7.0.24 binary must already be cached under `.local/mongodb-binaries`. Missing binaries are a setup prerequisite, never a reason to silently access a real Atlas account or reset data. Browser binaries are project-local under `.local/browsers`.

Role entry points:

- `/admin` — account counts, account creation/activation, platform health, activity and settings.
- `/professional` — today/upcoming appointments, manual payment verification, compact service/customer/expense tables, reports, availability, advertisements and business settings.
- `/account` — upcoming appointments, booking history, payments, professional discovery, booking and account settings. Deep links include `/account/appointments`, `/account/history`, `/account/book` and `/account/profile`.

The shared dashboard shell uses system fonts, white/light-gray surfaces and restrained purple accents. Navigation collapses on phones; Escape closes it and restores toggle focus. Compact primary navigation offers an expandable additional-tools menu. Tables can be scrolled horizontally with keyboard focus on narrow screens. See [dashboard guide](docs/DASHBOARDS.md).

The new demonstration uses `.local/multi-professional-data`, database `salon_multi_demo`, and generated private accounts in ignored `.local/multi-professional-accounts.json` (0600). Its seed contains a synthetic admin, two independent professionals and a customer; browser checks add clearly labelled synthetic accounts and records. Passwords are never printed or committed. SMTP is forced to safe mode; no real messages or money transfers occur.

The previous `.local/mongodb-data`, `salon_demo` database, `.local/demo-accounts.json`, and visual-review archive are preserved. Historical owner/staff accounts are **not** automatically converted and cannot authenticate into the new business authority model. Do not assume the previous demonstration login credentials are current accounts.

For an authorised Atlas target, configure `server/.env` from its example with MONGODB_URI, a random JWT_SECRET, CLIENT_ORIGIN and optionally temporary ADMIN_SETUP_TOKEN, then use `npm run dev`. Live migration/backfill is not automatic: follow the reviewed mapping/index plan first. `npm run provision-admin -w server` reads private account JSON from stdin and uses the controlled one-time admin endpoint. The old owner provisioning script/endpoint is disabled.

## Architecture and data

The React 19/React Router client is compiled by esbuild and Tailwind CSS 4. The Node 22/Express 5 API uses Mongoose 8 and MongoDB replica-set transactions. Playwright covers browser workflows; Node's test runner and an isolated in-memory Mongo replica set cover backend behavior. No Vite or payment gateway is used.

Principal collections include users/sessions, per-professional profiles/services, appointments/slot claims, payments, expenses, professional-customer relationships, guest customers, notifications/audits, platform settings, advertisements and media metadata. Image/video bytes are outside MongoDB in local ignored development storage or a configured private S3-compatible bucket. Records keep server-controlled professional ownership. Legacy records are retained and unassigned business records fail closed. See [final architecture](docs/FINAL_ARCHITECTURE.md) and [current API](docs/MIGRATION_API.md).

## Group demonstration accounts

Fictional test identities are seeded idempotently into the isolated local demo: Mpho Mokoena (admin), Lerato Thabane (professional) and Neo Rasebetsi (customer). Usernames are fixed; passwords are generated locally and stored only in ignored `.local/group-demo-credentials.json` (0600). Run `npm run demo:credentials` for usernames and retrieval instructions. Credentials are never printed during normal startup or committed to source/docs. See [group testing instructions](GROUP_TESTING.md).

The demo includes Lerato Beauty Studio, eight realistic service offerings and three published demonstration advertisements. Rerunning the seed updates records without duplicating accounts, services or ads.

## Verification

```bash
npm run check
npm run build
npm run test:e2e
```

Backend tests use isolated synthetic Mongo replica sets with runtime downloads disabled. Browser tests require the synthetic demo servers, project-local Chromium and the generated new role accounts. They create synthetic test records only. They do not process money or send email. See PROGRESS.md for actual results, not just script availability.

Latest local verification after the media/workflow work: `npm run lint`, `npm run build`, and `MONGOMS_RUNTIME_DOWNLOAD=false npm test` passed; the backend suite reports 43/43 tests. The full Playwright run was attempted and exposed browser navigation coverage drift from the compact sidebar; several tests were updated to use the expandable “More tools” navigation, and the complete suite must be rerun before claiming browser acceptance. A new service-image browser workflow passed in the full run. See current [PROGRESS.md](PROGRESS.md) for precise results and remaining browser verification.

`npm run migration:assess -w server` performs a **read-only** target database inventory through an authorised private MONGODB_URI. It reports legacy roles, unassigned counts and obsolete-index warnings without amounts, account details or credentials. There is no apply/drop/reset mode. Production checks require the new integrity indexes; additive index creation does not delete retained legacy indexes.

## Data and design status

Old roles, IDs, collections, records and financial history remain intact. Unassigned historical business data is quarantined from active reads/writes/workers. Mapping old users and global records requires explicit ownership decisions, backups and a future reviewed backfill. No global owner-to-admin conversion or inferred ownership is performed.

The three dashboards have been redesigned with system typography, white/light-gray surfaces, restrained purple accents, compact tables/forms and consistent role-specific navigation. The three referenced images were not available in the message or checkout, so implementation follows the written design requirements; reference-image fidelity remains unverified. Public marketing pages retain their existing separate styling.

No deployment, external account change or real email is authorised. Atlas/provider-side verification, private persistent media storage setup, real business configuration, explicit legacy backfill and offline private records remain external/future requirements.

## Completion status and known limits

Locally implemented workflows include admin account management; professional services, settings, schedule, customers, appointments, expenses, manual payments/reports, notifications and advertisements; customer registration, discovery, booking, appointment/payment status and profile; guest/phone bookings; profile/service photos; advertisement images/video; and in-progress appointment transitions. The backend supports S3-compatible persistent media, but provider credentials/configuration, bucket policy, and live hosting are not supplied or verified. Rate limiting is process-local; a multi-replica deployment needs a reviewed shared store and proxy configuration. The pilot checklist is prepared but no participants or real users have tested the system. See [deployment preparation](docs/DEPLOYMENT.md), [pilot checklist](docs/PILOT.md), and [PROGRESS.md](PROGRESS.md).


## Google login and installable PWA (partial)

Optional Google sign-in and a cached offline application shell are implemented in this source snapshot. See [Google and PWA guide](docs/GOOGLE_AND_PWA.md) for setup and limitations. Offline private records are not supported yet.
