# Implementation progress — 2026-11-17

## Current phase and status

Local implementation, automated validation, synthetic demonstration, deployment preparation and handover materials are implemented. **External acceptance remains blocked** on authorised Atlas credentials, approved real SMTP delivery, owner-verified real salon content, approved hosting/staging configuration, and consenting pilot participants. Do not claim production readiness or real pilot outcomes.

## Phase acceptance record

| Phase | Local result | Remaining external acceptance |
| --- | --- | --- |
| 1 Foundation | Passed: DNS resolves, dependencies installed, frontend/API respond, lint/build/tests pass | Actual Atlas connectivity remains unconfigured |
| 2 Authentication | Passed local API/browser checks: customer-only registration, bcrypt, strict JWT, rotating refresh cookies, logout/password revocation, owner provisioning, staff management/permissions, profile | Real owner provisioning requires chosen credentials and private setup token |
| 3 Public website | Passed desktop/mobile browser navigation, database-backed menu/settings, account pages and responsive shell | Real branding/contact/hours/services/policy must be owner verified |
| 4 Services/staff | Functional owner create/edit/activation and staff schedules/verifier permission; service create/deactivate browser test passed | Optional storage provider account/upload integration not configured; HTTPS links supported |
| 5 Booking | Passed concurrency, availability, hold expiry/release, snapshot, ownership, reschedule rollback and completion/no-show checks | Repeat transaction/load checks on authorised Atlas before live use |
| 6 Manual payments | Passed record-without-confirmation, verifier permission, verify/reject/info, concurrent duplicate verification/record, expiry and overpayment checks | Real independent money verification/reconciliation requires authorised personnel; no gateway exists |
| 7 Team dashboards | Operational overview, appointments/customers/services/staff/payments/pending confirmations/expenses/reports/settings/notifications/audit/profile | Role workflows still need owner/user acceptance with real configured operations |
| 8 Customer dashboard | Own appointments/history/reference/policy/payment/profile/change/notification workflows; browser reschedule/cancel passed | Actual cancellation policy/legal wording requires owner approval |
| 9 Email | Safe simulated logs, escaped HTML/text, queue, failure/retry tests with injected synthetic transports passed | No real SMTP credentials or delivery approval; no real emails sent |
| 10 Bookkeeping | Verified receipts, fee/balance breakdown, expenses/categories, daily/date-range reports, week/month presets, outstanding/popularity/Recharts/CSV | Actual accounting/reconciliation acceptance; refunds/tax ledger are explicitly outside current feature scope |
| 11 Settings | Owner-validated public identity/contact/hours/closures/fee/hold/policy; normal hours/workday controls | No real business details invented |
| 12 Security/reliability | Validation/permissions/ownership, session revocation, transactions/index checks/audit, headers/CORS/rate limits and known-dependency audit | Production proxy/shared-store review, backups/restore, load/security/privacy review remain pre-deployment checks |
| 13 Testing | Final backend checks: 24/24 pass; Playwright: 4/4 pass, including phone viewport and owner/staff/customer flows | External-provider staging and broader device/load testing not executed |
| 14 Demonstration | Running local frontend/API with persistent synthetic replica set and generated demo accounts; restart persistence repaired and verified | Atlas-backed demonstration requires authorised connection; synthetic local DB is explicitly separate |
| 15 Deployment preparation | Vercel output/proxy and Render blueprint, environments/index/bootstrap scripts and maintenance checklist prepared | No deployment/account changes/charges; hosted routing/TLS/Atlas/SMTP unverified |
| 16 Pilot/evaluation | Consent planning, 8–15 participant plan, tasks, questionnaire, measures, two iteration templates prepared | Recruitment/consent/fieldwork/results not collected or fabricated |
| 17 Handover | README, architecture/schema/API, user guides, deployment/maintenance/troubleshooting, checklist/pilot/progress docs prepared | Update actual provider/pilot outcomes only when evidence exists |

## Implemented business guarantees

- No payment gateways and no automated WhatsApp messaging. Links are manual click-to-chat only.
- Integer lisente storage, M display, UTC instants, Africa/Maseru scheduling/display.
- Unique staff quarter-hour slot claims cover every occupied interval; insert/reschedule/cancellation/expiry use real Mongo transactions.
- Booking snapshots preserve name/duration/service price/fee/total/policy/version/acceptance timestamp.
- Recording payment never marks funds received. Only owner or explicitly permitted verifier can verify; payment and appointment state commit with audit/notification in one transaction.
- Concurrent verification returns one success and one conflict; duplicate fee/balance income and overpayments are rejected. Unique method/reference and serialising appointment revisions protect competing records.
- Confirmed appointments do not expire as unpaid holds. Expired/cancelled payments cannot resurrect closed bookings. Received income is retained after cancellation pending external reconciliation.
- Short-lived access tokens are in memory; refresh secrets are hashed in DB and rotate in HttpOnly cookies. Logout/change/deactivation invalidate access through live session/user checks.
- Production startup checks required unique integrity indexes and fails closed when missing. No silent database fallback.

## Actual commands and results

- `npm ls --depth=0`: dependencies present at initial reinspection.
- DNS lookup of registry.npmjs.org: succeeded in this session; prior EAI_AGAIN was environment/network related.
- Project-local npm installs: mongodb-memory-server, MongoDB driver, Playwright, Prettier and updated Nodemailer; package lock maintained.
- `npm run check`: frontend/backend lint passed; **24 backend foundation/API/transaction tests passed, 0 failed** on final run.
- `npm run build`: esbuild/Tailwind production build passed.
- `npm run test:e2e`: **4 passed, 0 failed** on final run: desktop/mobile public navigation; customer login/refresh/booking, owner fee verification, customer reschedule/cancel and reports; registration/logout/restriction; service create/deactivate and mobile staff restrictions.
- Browser Chromium installed under `.local/browsers`; no privileged OS package installation.
- `npm audit`: final audit completed and reported **0 vulnerabilities**.
- HTTP checks: frontend 3000 and API 4000 healthy; `/api` development proxy works.
- `node --check`: checked backend/startup/proxy/build configuration syntax; build/lint also parse actual sources.
- `git status --short`: reported that this directory is not an initialised Git repository. No Git commit/push or destructive repository operation was performed. Git history setup remains a local handover task.

## Defects found and fixed

- Earlier unavailable dependencies/network/socket restrictions: current environment resolves npm and permits local listeners; no sandbox configuration was changed by the project.
- Misleading listener success after failure: now logs success only after listen succeeds.
- Initial test expectation for unknown protected routes updated to authenticated API semantics (401 before route lookup).
- Synthetic email assertion normalised lowercase, matching account storage.
- Playwright ES module/selector configuration fixed; test discovery and accessible role selectors work.
- Persistent Mongo replica restart originally reused a stale member port. Local-only helper now reconfigures its existing single member address without deleting demonstration data. Subsequent restart succeeded and preserved services/accounts/records.
- Old Nodemailer dependency audit advisories: upgraded to 10.6.0, audited with no known vulnerabilities reported after installation.
- Financial grouping uses dictionaries without inherited prototype keys; error responses do not echo malformed JSON body text.
- Management writes and associated audit entries commit transactionally; verification also increments appointment revision to serialise competing financial operations.

## Running services and private local artifacts

- Frontend: http://localhost:3000 (existing project `node scripts/dev.mjs` process reused).
- API: http://localhost:4000/api/health (`npm run demo -w server` retained session; safe email mode).
- Owner/staff: http://localhost:3000/admin; customer: http://localhost:3000/account.
- Synthetic account passwords are generated and stored in ignored `.local/demo-accounts.json` (0600), never printed or committed. No real account details are supplied.
- Local replica data: `.local/mongodb-data`; binaries: `.local/mongodb-binaries`; browser/cache artifacts are ignored.
- `npm run demo` starts both when their ports are free; with an existing frontend, run/manage only the API to avoid EADDRINUSE. Never stop unrelated listeners.

## Known limitations

See docs/FEATURE_CHECKLIST.md for full scope. One staff resource/one daily shift/quarter-hour durations; no split shifts or room constraints. No file upload provider, refunds/reversal ledger, tax accounting, password recovery or email verification. Email delivery is at-least-once. Selection forms currently fetch up to 100 options. Production rate limiting is process-local until a reviewed proxy/shared-store configuration is supplied. These limits are not concealed behind placeholder success states.

## Next actions and exact resume instruction

Resume with: **Read AGENTS.md, PROGRESS.md and docs/FEATURE_CHECKLIST.md. Inspect code and existing listeners before edits. Preserve React/esbuild (no Vite) and external manual payments. Recheck current HTTP/health and actual final checks. Continue only remaining independent defects or authorised external acceptance: privately supplied Atlas configuration and index provisioning; owner-verified salon data/policy; approved SMTP controlled delivery; approved staging deployment/proxy/security/backup checks; consenting-user pilot and two evidence-based iterations. Never print credentials, contact real users, send real emails, deploy, alter external accounts or invent outcomes without approval. Keep progress and documentation accurate.**
