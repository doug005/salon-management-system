> Historical single-salon documentation. The current controlling role/ownership architecture is [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md), with current endpoints in [MIGRATION_API.md](MIGRATION_API.md). Owner/staff permissions and shared financial access described below no longer apply. Existing deployment preparation remains unverified; consult PROGRESS.md before use.

# Feature and verification checklist

This file distinguishes implemented code from external acceptance. Actual command outcomes and current blockers are maintained in PROGRESS.md. No production-readiness or real pilot outcome is claimed.

| Phase | Implemented scope | Acceptance evidence / outstanding checks |
| --- | --- | --- |
| 1 Foundation | React/esbuild/Tailwind routing, Express startup, local replica set, project scripts and environments | Local frontend/API HTTP success; lint/build and foundation tests pass |
| 2 Authentication | Customer-only registration, bcrypt, strict JWT, rotating HttpOnly refresh, revocation, one-time owner setup, staff management/profile/password | API integration tests exercise escalation, refresh replay, logout/password revocation, deactivation and roles |
| 3 Public site | Responsive Home/About/Services/Booking/Contact/Login/Register/Account/404; database services/settings | Desktop/mobile browser checks; real identity/contact remains owner input |
| 4 Services/staff | Owner CRUD-style create/edit/activate/deactivate; duration/price/image URL validation; staff weekdays and working hours | Role/validation API checks; image upload deliberately not enabled, configurable HTTPS storage links documented |
| 5 Booking | Availability, unique staff slot claims, transactional concurrency, references/holds/expiry, snapshots and state transitions | Real local Mongo replica-set tests for race rejection, reschedule rollback, ownership, expiry and completion; Atlas still external |
| 6 Manual payments | Configurable positive fee/deduction/policy, manual record/review, pending confirmations, verifier permissions/audit/transactional confirmation | Concurrent verification and duplicate record tests; rejection, information request, expiry and overpayment tests; no gateway |
| 7 Team dashboards | Overview, upcoming visits, customers, staff, services, appointments, payments, pending confirmations, expenses, reports, settings, notifications/audit/profile | Functional forms and APIs; browser owner workflow validation recorded in PROGRESS.md |
| 8 Customer dashboard | Own history/status/references, policy, changes within policy, profile/payment/notifications and WhatsApp link | API ownership checks and browser workflows; real WhatsApp sends are never automated |
| 9 Email | Escaped HTML/text templates, transactional queue, safe mode, failure tracking, bounded retries and owner retry | Safe mode and injected-transport failure/success tests; real approved SMTP delivery remains external |
| 10 Bookkeeping | Fee/balance receipts, outstanding, expenses/categories, date filters, income/profit/popularity/Recharts/CSV | Deterministic and database integration totals; not a tax accounting/refund ledger |
| 11 Settings | Business name/description/contact/hours/closures/fee/hold/policy and staff verifier permission | Owner API/UI with validation and versioned policy; real values not invented |
| 12 Security/reliability | Validation, roles/ownership, headers/CORS/rate limits, session security, transactions, indexes and audits | Tests and audit results recorded; production proxy/shared rate store and load checks remain pre-deployment work |
| 13 Testing | Unit/API/transaction tests plus Playwright desktop/mobile/customer/owner workflows | Only actual completed runs in PROGRESS.md count as passed |
| 14 Local demo | Synthetic persistent local Mongo replica set/accounts/services, safe mode, running URLs | Local HTTP/browser evidence; no claim of Atlas credentials or real money |
| 15 Deployment prep | Vercel static build + same-origin function proxy, Render blueprint, env/index/bootstrap scripts/checklist | Prepared, not deployed; provider-side routing, TLS, Atlas/SMTP and costs require approved external setup |
| 16 Pilot pack | Consent planning, 8–15 participant plan, tasks, questionnaire, measures and two iteration templates | Materials prepared; recruitment/consent/feedback/results are not collected |
| 17 Handover | README, architecture/schema/API/user/deployment/troubleshooting/pilot docs and progress | Documents describe actual code and limitations |

## Known limitations and future improvements

- No authorised Atlas URI, live SMTP, production hosting, real salon content or participant consent is supplied; these cannot be fabricated.
- Schedule uses one staff resource per visit, quarter-hour durations and one shift per day; no room/chair constraints, per-service skills, split shifts or staff holidays beyond salon closure dates.
- Positive booking fee required; free bookings and fee waivers need a separately designed confirmation policy.
- File uploads are disabled. Images/evidence use HTTPS links; receipt access/privacy must be reviewed before live use. No OCR or screenshot-based verification exists.
- Refunds, reversals, statutory tax accounting and bank reconciliation are external/manual procedures, not implemented accounting modules. Received funds on cancellation remain received income until independently reconciled.
- Email is at-least-once, not exactly-once. SMTP outages can delay messages; safe simulated logs are not proof of delivery.
- Refresh rotation detects replay of a consumed token but does not implement a full token-family reuse-response system. Access is checked against live session/user records and revoked at logout/change/deactivation.
- Password recovery and email address verification are future additions; current profile editing changes name/phone, not email. Owner-managed initial passwords need secure handover.
- Per-process rate limiting, production trusted-proxy configuration, monitoring, backup restore drills, load testing, legal/privacy/retention review and external penetration testing remain pre-production tasks.
- Report date semantics are explicitly mixed by business event (verification, expense incurred, visit date) and are labelled. CSV exports summary metrics, not private bulk customer data.
- Public booking/customer selection forms currently fetch up to 100 records per selector; list pages paginate, but very large catalogues/customer bases need searchable selectors.
- No Git commit/push or external account change has been performed by this work.
