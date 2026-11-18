> Historical single-salon documentation. The current controlling role/ownership architecture is [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md), with current endpoints in [MIGRATION_API.md](MIGRATION_API.md). Owner/staff permissions and shared financial access described below no longer apply. Existing deployment preparation remains unverified; consult PROGRESS.md before use.

# Deployment preparation, maintenance and troubleshooting

**No deployment has been performed.** Hosting/Atlas/SMTP accounts and charges require approval. This document prepares configuration; it does not claim hosted acceptance.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| MONGODB_URI | Private backend | Authorised Atlas replica-set URI, dedicated database/user, encoded password and least privilege |
| JWT_SECRET | Private backend | Random >=32 characters; rotate deliberately (invalidates access signatures) |
| NODE_ENV | Backend | production when hosted; secure refresh cookies and deliberate index provisioning |
| PORT | Backend host | Host-assigned port; production listener uses 0.0.0.0 |
| CLIENT_ORIGIN | Backend | Exact frontend HTTPS origin, without trailing slash; refresh/logout CSRF check |
| OWNER_SETUP_TOKEN | Backend temporarily | Random >=32-character one-time provisioning token; remove after provisioning |
| EMAIL_MODE | Backend | safe by default; smtp only after approval |
| EMAIL_DELIVERY_APPROVED | Backend | Must be yes as an additional explicit live-delivery gate |
| SMTP_HOST/PORT/USER/PASSWORD/FROM | Backend only | Approved SMTP transport; never bundle in client |
| PUBLIC_API_URL | Client build | Keep `/api` for same-origin proxy |
| BACKEND_ORIGIN | Vercel function only | Actual approved Render HTTPS origin, no path/credentials; never user-controlled |
| AD_STORAGE | Private backend | `s3` in production; development filesystem is project-local only |
| AD_S3_BUCKET/AD_S3_REGION/AD_S3_ENDPOINT | Private backend | Private S3-compatible bucket location for advertisement and business media |

No secrets belong in Git, frontend public values, docs, logs or screenshots. `.env`, `.local` and test/browser artifacts are ignored. Do not use the local demo launcher in production.

## Atlas and database preparation

Create/select an owner-authorised database and least-privilege database user, enable appropriate network allowlisting/TLS, and supply its URI privately. Do not open access to all IP addresses as a shortcut. Test transactions against the actual cluster and take a backup before any migration. Existing Phase 1 development records may not satisfy the expanded schema; do not silently mutate a real database. Use an approved migration plan or a separate fresh development database.

Run `npm run db:indexes -w server` with the target private environment after review. It uses createIndexes, not destructive syncIndexes. Confirm unique email, refresh-token, business singleton, appointment reference, staff-slot and payment reference indexes. The API requires the unique slot/payment indexes before accepting bookings/payments; production disables automatic index creation. Check TTL session cleanup too. Back up data before index work on an existing installation and resolve duplicates deliberately.

## Frontend: Vercel preparation

`vercel.json` declares root build `npm run build`, output `client/dist` and SPA history fallback. `api/[...path].js` is a same-origin HTTPS proxy to the configured backend. It preserves API paths, Origin, bearer headers and Set-Cookie, and never accepts a target from the user. This supports the existing esbuild build; Vite is not required.

Configure BACKEND_ORIGIN as a private function variable and CLIENT_ORIGIN on Render to the approved Vercel/custom domain. Use the same frontend origin throughout. Keep PUBLIC_API_URL=/api so refresh cookies remain first-party; directly pointing the browser at a separate Render site is incompatible with the strict cookie strategy. Test login, refresh, logout, deep links, API error JSON, cookie Secure/SameSite/HttpOnly flags and proxy routing in an approved staging deployment before production. Deployment configuration is prepared but provider-side routing has not been verified by deployment.

Reference: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [rewrites](https://vercel.com/docs/routing/rewrites).

## Backend: Render preparation

`render.yaml` prepares a Node service with `npm ci --omit=dev`, `npm run start -w server`, health path `/api/health`, private environment inputs and safe email mode. Render supplies PORT; the production API listens on 0.0.0.0. Supply Atlas URI and frontend origin through the approved account. Set NODE_VERSION to a supported Node 22 release if the account default differs. Configure the health check and verify database readiness.

Rate limits are currently process-local. Production behind a proxy needs a reviewed exact trusted-proxy configuration (never blindly trust arbitrary X-Forwarded-For) and a shared rate-limit store before multiple API replicas. The background expiry/notification/media worker is designed for retries and uses transactional writes/notification locks, but needs production monitoring. Use an always-on service for timely hold expiry and delivery; availability/writes also clean up expired holds.

Configure `AD_STORAGE=s3` and the private S3-compatible bucket/region (and endpoint if applicable) for both `advertisements/*` and `business-media/*`. Grant only GetObject/PutObject/DeleteObject for those prefixes, block public bucket access, enable provider encryption, and test upload/replacement/read/delete on staging. Advertisement video uploads are buffered up to 50 MiB; review host memory and request timeouts before a pilot or increased limit. Local storage is rejected in production because serverless/container disks may be ephemeral.

Reference: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [health checks](https://render.com/docs/health-checks).

## Costs and hosting requirements

No paid plan was selected and no price quotation is claimed. Budget for an appropriate always-on backend, Atlas storage/backups, frontend/function usage, optional object storage, SMTP and domain. Current pricing, quotas, acceptable-use terms and required tiers must be checked in the actual provider account before approval. A free/sleeping tier may delay background work and is not an operational guarantee. There are no payment-gateway transaction fees because the app does not process payments; external payment arrangements can have their own fees.

## Deployment checklist

- [ ] Approval for deployment, external accounts and any charges.
- [ ] Owner-verified identity/contact/services/prices and lawful policy/privacy/consent text.
- [ ] Authorised Atlas connection, backup/restore drill, migrations and required indexes.
- [ ] Private environment and strong secrets; one-time owner provisioned and setup token removed.
- [ ] `AD_STORAGE=s3`; private object bucket configured for both prefixes, access/persistence and lifecycle verified, and media upload/read/delete smoke-tested on staging.
- [ ] Exact origin, proxy routing, secure cookies, TLS and reviewed proxy/rate-limit settings.
- [ ] Unit/API/concurrency/browser/mobile tests rerun on staging.
- [ ] Synthetic data kept separate from production; no test accounts publicly exposed.
- [ ] SMTP approval and controlled test delivery before enabling customer messages.
- [ ] Alerting for database, expiry worker, failed email, verification and audit failures.
- [ ] Manual payment/reconciliation/refund procedures and authorised personnel trained.
- [ ] Rollback and backup plan, log retention/access control, maintenance owner.

## Maintenance and recovery

Keep dependency lockfiles, rerun `npm audit` after changes, and apply updates with tests rather than force-upgrading blindly. Back up Atlas on an approved schedule and test restoration into a separate authorised database. Monitor health and worker errors; safe logs omit credentials. Review payment audits and failed notifications. Never fix a financial discrepancy by directly marking a pending payment paid; use the authenticated verification workflow and independent evidence. Refunds and corrections need a documented external reconciliation procedure; no refund/ledger reversal feature currently exists.

## Troubleshooting

- **EAI_AGAIN**: earlier environment could not resolve npm; current checks resolve and install successfully. Diagnose network/DNS without changing system settings. Existing lockfile permits reproducible `npm ci --cache .npm-cache`.
- **EADDRINUSE**: inspect the process bound to 3000/4000. Reuse/restart only this project's known dev process; do not kill unrelated listeners.
- **EPERM opening sockets**: earlier sandbox policy blocked networking. Record the policy blocker; never disable protections to bypass it. Current session can bind and HTTP checks succeed.
- **API 503/startup failure**: validate private environment, cluster reachability and credentials without printing the URI. The API fails closed, rather than silently using a different database.
- **Booking conflict**: another reservation may have acquired a staff slot. Reload availability and select another time. Never remove slot documents manually to force a booking.
- **Expired hold**: reconcile late money manually; create a new reservation if available. Never resurrect a cancelled slot by verifying an expired record.
- **Refresh fails**: confirm one origin, first-party proxy, correct CLIENT_ORIGIN and cookie flags. Access tokens are intentionally absent from localStorage.
- **Email simulated**: expected safe mode. Real SMTP needs separate approval and complete configuration. Failed SMTP does not undo appointments.
- **Missing browser libraries**: Playwright downloads are local; do not install privileged OS packages automatically. Record the external prerequisite if compatible libraries are unavailable.
