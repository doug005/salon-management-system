# Progress — Milestone 2: professional advertisements

## Current status

Milestone 1 role/ownership foundation remains implemented. Milestone 2 is implemented and verified. Stop here before dashboard redesign or PWA work. The user's milestone 2 requirements supersede the former advertisement moderation design: **professionals exclusively manage their advertisements, without admin approval or moderation**. Root AGENTS.md and docs/FINAL_ARCHITECTURE.md now record this rule. Admin financial restrictions remain intact.

## Implemented in milestone 2

- Professional-only own create, edit, publish, unpublish, delete and image upload APIs; foreign IDs are denied before decoding or storage. Strict content validation rejects ownership/status/timestamp injection.
- Transaction-serialized three-active-ad limit per professional. Immediate publication lasts exactly seven days; editing preserves expiry; unpublish hides immediately; republish starts a new period after rechecking capacity.
- Public homepage and professional-profile cards with responsive images, professional management forms, status/expiration display, loading/error/empty states and delete confirmation. No admin advertisement page or management endpoint.
- PNG/JPEG/WebP uploads capped at 5 MiB and 20 megapixels, decoded/re-encoded to metadata-free WebP; random storage keys, no binaries in MongoDB. Local development storage and configurable private S3-compatible production adapter.
- Public API and image endpoints enforce the exclusive seven-day cutoff without relying on cleanup. Images use no-store caching and public projections exclude internal storage/moderation fields.
- Worker cleanup every 30 seconds: expired records marked expired, image references detached, unreferenced replacement/deletion files reclaimed. Shared references retained, staged uploads have one-hour grace, failures counted/timestamped with sanitized logging and safe retries.
- Added AdvertisementImage lifecycle records and unique professional AdvertisementLock; additive index verification. Historical moderation fields/data are retained but confer no current authority.
- Updated README, architecture, API documentation, root instructions and environment example. Detailed storage/API/operational guidance in docs/ADVERTISEMENTS.md.

## Commands and actual verification results

- `npm install -w server sharp @aws-sdk/client-s3`: succeeded, audited 422 packages, zero reported vulnerabilities at installation.
- `npm run build`: esbuild/Tailwind production build passed.
- `MONGOMS_RUNTIME_DOWNLOAD=false npm run check`: **39 backend tests passed, 0 failed; frontend/backend lint passed**.
- Final worker change isolates job failures so advertisement storage errors cannot block hold expiration or safe notification work; `node --check server/src/index.js` and `npm run lint` passed afterward.
- Existing 37 backend tests passed. New tests initially found a stale revoked test session, then a real advertisement audit payload type mismatch. Tests now obtain a fresh session; audit writes now supply the required text value, preserving transactional mutations.
- Playwright full run: five existing workflows passed; advertisement upload assertion failed. The backend audit payload bug was fixed; the remaining browser failure was traced to a corrupt PNG fixture (confirmed by the image decoder), replaced with a generated synthetic PNG.
- `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e -- --grep "advertisement lifecycle"`: **1 passed**, covering upload, immediate publication, mobile homepage/profile images, no horizontal overflow, unpublish, republish and delete. All six browser workflows passed across the full run and affected-test rerun; no skipped tests are presented as passing.
- No external S3 bucket or SMTP delivery was used. S3 deployment configuration remains unverified externally.

## Preservation and operational state

Existing legacy and multi-professional databases, accounts, appointments, payments and financial history are preserved. No role backfill, index drop, collection reset or external account change was performed. Tests use an isolated ephemeral integration database; browser tests use synthetic records in the existing isolated multi-professional demo. Test teardown only removes newly created advertisement fixtures from the ephemeral integration database and their own files.

Final startup checks returned HTTP 200 for frontend and API health. Local demo API was restarted to load this milestone; frontend remains on http://localhost:3000 and API on http://localhost:4000. SMTP is safe mode. Credentials remain in ignored `.local/multi-professional-accounts.json` and are not included in documentation. Local advertisement files are under ignored `.local/ad-images/`. Previous databases, credentials and review artifacts remain in place.

## Remaining work and blockers

- Production S3-compatible bucket configuration, credentials and live storage verification require authorised external setup. Production local advertisement storage is rejected; do not deploy until provider configuration is verified.
- Worker must run for physical cleanup; public expiry is always enforced independently. Switching storage backends/buckets with existing files requires an explicit migration plan.
- Legacy account/ownership mappings, verified backups/backfill and obsolete-index transitions remain separately reviewed work. No guesses or automatic conversions.
- Next priority after this milestone: redesign admin/professional/customer dashboards using supplied reference images; images have not yet been supplied. Then basic offline PWA support. Neither workstream is started here.
- This directory has no Git repository metadata; no commit was created. Existing files remain in place.
- No production readiness, actual participant feedback or real message-delivery claim.

## Exact resume instructions

Read AGENTS.md, PROGRESS.md, docs/FINAL_ARCHITECTURE.md and docs/ADVERTISEMENTS.md. Milestone 2 verification is complete. Stop at the milestone boundary; begin dashboard redesign or PWA only in the next authorised task. Preserve professional-only ads, admin financial exclusion, MongoDB/Express/React/Tailwind/esbuild, manual external payments, Africa/Maseru and integer lisente.

```bash
cd /home/doug_17/Projects/salon-management-system
curl --fail --silent http://localhost:3000/ --output /dev/null
curl --fail --silent http://localhost:4000/api/health
# Only if both servers are stopped:
MONGOMS_RUNTIME_DOWNLOAD=false npm run demo
# If one component alone is stopped, start only that component:
npm run dev -w client
MONGOMS_RUNTIME_DOWNLOAD=false npm run demo -w server
# Checks after relevant changes:
MONGOMS_RUNTIME_DOWNLOAD=false npm run check
npm run build
MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e
```

Do not print credentials, reset test databases, deploy, send real messages or modify external accounts. Keep existing healthy servers running. Historical single-salon work remains in docs/PRE_MIGRATION_PROGRESS.md; obsolete moderation requirements there are historical, superseded by current AGENTS.md.
