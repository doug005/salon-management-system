# Customer experience audit fixes — verified implementation (2026-11-19)

## Completed

- Production public data now fails closed: demo professionals are not discoverable, service listings and promotional advertisements require an explicit owner-verified flag, and direct profile/service/advertisement media routes apply the same gate. The public shell uses the supplied salon identity and address — Makatleho Beauty Palour, Phomola Road, Lepoqong, Maseu 100, Lesotho — without fabricating phone numbers, email addresses, prices, payment recipients, reviews, or portfolio imagery. Generic external illustrative service-photo fallbacks were removed; only owner-uploaded media is rendered as a portfolio image.
- Customer booking can be explored before authentication. Professional, service, date, and time selections are preserved in the internal return URL through login or registration. Availability validation now checks the requested published professional/service pair. Loading, retry, and mobile touch-target states were improved, and the existing manual payment/confirmation semantics remain unchanged.
- Safe-mode customer login no longer blocks an otherwise valid password account solely because SMTP is unavailable. The session is marked `emailVerified: false` and displays a reminder; professional/admin accounts and deployments with SMTP enabled remain email-gated. Registration copy no longer falsely claims customers cannot sign in. Password reset and verification remain single-use/expiring and still require approved email delivery for actual messages.
- Owner-facing service management now exposes the public-verification flag. Production advertisement publication requires an explicit `{ verified: true }` acknowledgement; local/test demo publication remains compatible with its isolated fixtures. Essential retry, booking handoff, and pending-email strings received Sesotho catalog entries.

## Actual verification

- `npm run lint`: passed.
- `npm run build`: passed.
- `MONGOMS_RUNTIME_DOWNLOAD=false npm test`: **53/53 passed**.
- `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e`: **15/15 passed** on desktop/mobile isolated synthetic workflows.
- Production helper smoke check passed: public identity serializer returned the supplied name/address and `publicContentFilter()` returned `{ verified: true }`.
- Isolated safe-mode customer login smoke check passed with HTTP 200, a customer session token, and `emailVerified: false`. No credential values were printed or committed.
- `npm audit --omit=dev`: zero production advisories. The repository’s install output reported development-tool advisories; no force upgrade was applied.

## Production blockers and delivery state

- Approved production SMTP credentials and `EMAIL_DELIVERY_APPROVED=yes` were not available in this task, so real verification/recovery delivery was not claimed or tested. Do not switch `EMAIL_MODE=smtp` until the owner supplies and configures an approved provider through the existing Render service.
- The existing Vercel/Render infrastructure and GitHub repository are preserved. The verified change is ready for the authorized `main` push; deployment health and real hosted email delivery must be checked after the existing service hooks build the pushed commit.

# Urgent recovery — presentation, onboarding and local verification (2026-11-18)

## Current state

- Recovered the previous agent's work in place. Branch is `main`, HEAD started at `ce0a7eb`; no reset, discard, remote change, push, deployment, or real-account contact occurred. The existing `.gitignore` `.vercel` addition was present before this recovery and is intentionally excluded from the planned commit.
- Presentation deliverables are present: `presentation/Salon_Management_ICT4D_Presentation.pptx`, `presentation/Presentation_Script.md`, `presentation/Live_Demo_Guide.md`, `presentation/Submission_Checklist.md`, and image credits. The PPTX ZIP integrity check passed.
- Local checks after the recovery fixes: `npm run lint` passed; `npm run build` passed without duplicate-key warnings; `MONGOMS_RUNTIME_DOWNLOAD=false npm test` passed **53/53**; `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e` passed **15/15**. The first browser run exposed obsolete selectors and stale synthetic demo sign-in assumptions; tests were corrected to match secure invitations and current UI. Login throttling was cleared only by stopping/restarting the isolated local demo process; its persistent synthetic database was not reset. No production database or hosted service was used.
- E2E coverage verifies English/Sesotho preference persistence, offline fallback/public caching boundaries, professional appointment table/payment dialog, synthetic WhatsApp URL construction, manual receipt verification, service-image workflow, registration/authentication, and role isolation. It does not represent live email delivery, a real WhatsApp message, real funds, or tests of the four invitees' actual accounts.

## Professional invitation status and safety

- The four requested addresses are referenced in the protected invitation helper's exact allowlist check. No real professional account was looked up, created, or invited; no inbox was accessed and no password or email-verification bypass was used. Inviting them requires an authenticated administrator, a real configured database, and explicitly approved working SMTP; SMTP safe mode remains the default. Do not execute the invitation helper during local test verification.
- Google real-provider login and SMTP delivery remain untested. Do not claim production readiness, delivery to the four people, or successful setup by them.

## Remaining deployment/presentation limitations

- No deployment or push was requested or performed. Existing deployment readiness remains blocked by documented hosting/database/media-storage and SMTP prerequisites; see `docs/DEPLOYMENT.md` and `docs/PROFESSIONAL_ONBOARDING.md`.
- Sesotho coverage is partial and untranslated strings fall back to English. Service imagery contains illustrative/licensed examples and should not be presented as real professional portfolios. PWA offline mode is limited to the shell/public information; private data and booking/payment actions are neither cached nor queued.
- Before presenting, confirm group/partner details against the official assignment brief and test the PPTX on the presentation machine. See `presentation/Submission_Checklist.md`.

## Resume

Review the staged diff and make one local commit of completed requested implementation, presentation, documentation, and test updates. Exclude `.gitignore`; do not push or deploy. Preserve all synthetic/local and existing databases.

# Handover completion — appointments, WhatsApp, validation and authentication (2026-11-18)

## Current state

- Continued the existing uncommitted implementation; did not reset the branch, discard files, change remotes, deploy, or contact hosted services. Branch remains `main`; existing `origin` is unchanged. The unrelated pre-existing `.gitignore` edit is intentionally excluded from the handover commit.
- The earlier `MONGOMS_RUNTIME_DOWNLOAD=false npm run demo` had left an existing isolated multi-professional database and synthetic credentials file. Before work, local UI/API were not running. Started the repository demo, observed its explicit “Isolated multi-professional demo ready” and API-ready messages, and verified UI/API HTTP 200. Its `.local/multi-professional-data` database was preserved; no credentials were displayed. E2E data additions are synthetic and kept in that separate local database.
- **Local verification:** `npm run lint` passed; `npm run build` passed; `MONGOMS_RUNTIME_DOWNLOAD=false npm test` passed **50/50**; final `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e` passed **13/13**. The focused appointment/payment/WhatsApp browser workflow also passed. MongoDB runtime downloads were disabled. No production DB or hosted service was used.

## Work completed

- Replaced the professional’s large appointment cards with a compact semantic table, responsive mobile cards, Pending Confirmations/Confirmed/Completed/Cancelled/All filters, status counts, search/date filters, pagination, and a details dialog for payment recording/verification, WhatsApp, rescheduling and cancellation.
- Professional-to-customer WhatsApp now uses only the customer WhatsApp number snapshotted on that booking, validates it before constructing `wa.me`, and renders a disabled control with an explanation and alternate email/phone contact when no valid number exists. It never substitutes the professional’s `+266 56903048`. Confirmation copy follows the requested format and appears only after both payment is verified (`paid`) and the appointment is confirmed. Opening WhatsApp never sends the message or changes payment state.
- Kept customer-to-professional WhatsApp booking intact. Browser coverage checks the professional destination for the customer’s booking request and a separate customer destination for the professional’s message; the confirmation details, fee receipt/verification and payment/appointment state transition are checked. Backend tests verify no number inference, contact snapshot persistence, tenant ownership and atomic manual verification.
- Strengthened shared Zod checks for names, normalized emails, international phone/WhatsApp numbers, booking IDs/dates/policy acceptance and positive integer payment amounts. Added client inline field errors for registration, profile and booking forms; server field-error paths remain available to the browser. Existing transaction-based duplicate slot/payment protection is unchanged.
- Email/password customer registration now has single-use email verification; forgot/reset and resend flows use hashed, expiring challenges, enumeration-safe responses and session revocation on password reset. Google sign-in verifies signed Google tokens and one-time nonces; existing matching-email accounts require an authenticated explicit link, and Google can only create customer accounts. Google display names are normalized through the same safe name schema. Added synthetic end-to-end authentication tests.
- Updated [docs/GOOGLE_AND_PWA.md](docs/GOOGLE_AND_PWA.md) with SMTP safe-mode and delivery configuration prerequisites.

## Limits and resume

- Google real-provider login and real SMTP message delivery were **not** tested. Google requires `GOOGLE_CLIENT_ID` in the backend, the matching `PUBLIC_GOOGLE_CLIENT_ID` in the client build and correct Google authorized origins. Email requires an approved backend SMTP provider and explicit `EMAIL_DELIVERY_APPROVED=yes`; current safe mode does not send email. No credentials were found or configured by this work.
- No live WhatsApp chat was opened, message sent, real payment recorded/verified, external account touched, deployment or push performed. Local test payment records are synthetic only. Do not claim production readiness.
- The first broad browser retry encountered the demo’s process-local login rate limit; restarted only the project-owned demo (database preserved). One earlier test assertion was corrected to inspect the professional-side contact projection, and a synthetic UI name fixture was corrected to follow the new numeric-name rejection. The final complete browser run passed without weakening rate limits or assertions.
- Next: review the scoped changes and create the requested local commit, excluding `.gitignore`; do not push or deploy without authorization. The current demo process can be stopped safely after review; its database is persistent and remains intact.

# WhatsApp booking and manual confirmation — deployed/live smoke (2026-11-18)

- Implemented the requested website confirmation dialog, duplicate-submit guard, saved `SAL-` reference, pending appointment state, customer/professional notifications, per-professional WhatsApp handoff/retry, manual receipt recording and payment verification, customer confirmation email queue, and professional Pending Confirmations UI.
- Required international WhatsApp numbers are validated server/client-side with `libphonenumber-js`, normalized to E.164 and stored on ProfessionalProfile. Admin professional setup and professional settings require the number. Missing existing numbers block online bookings and prompt completion. The isolated local demo assigns `+26656903048` only to its explicitly synthetic professionals; the group seed targets the fictional Lerato account. Real accounts are not modified by the local demo.
- Booking requests are `pending_confirmation`; the UI presents payment as awaiting verification/arrangement without creating a financial receipt. A receipt only exists after the professional records actual external funds/method/reference. Only the owning professional can verify; a transaction checks payment state, booking eligibility and reserved slots before marking the receipt paid and appointment confirmed. Duplicate, cancelled and expired confirmation is rejected. Mobile-money agent was added as a manual payment method. Email delivery failure is tracked and cannot roll back a verified booking.
- The WhatsApp chat targets the selected professional, contains saved booking data and URL-encoded text, and never sends automatically or changes payment state. The saved result remains visible with a retry link if WhatsApp navigation fails.
- **Local verification:** `npm run lint` passed; `npm run build` passed; `MONGOMS_RUNTIME_DOWNLOAD=false npm test` passed **45/45**; `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e` passed **13/13**, including desktop/mobile dialog, cancel without booking, WhatsApp error recovery, exact selected contact/message, pending confirmation, manual verification, customer status and email-failure handling. `npm audit --omit=dev` reported zero production advisories.
- **Deployment:** Authorized commit `c80647e` was pushed to the existing `origin/main`. Vercel's `/app.js` serves the new dialog, WhatsApp retry and international phone validation code; Render's API accepted normalized E.164 profile settings and served the new pending booking semantics. Vercel and Render health returned HTTP 200; public settings/professionals/services/advertisements all returned HTTP 200 (1 professional, 8 services, 3 ads).
- **Live smoke:** Updated only the explicitly fictional Lerato demo profile to `+26656903048` and restored its missing demo opening hours (Mon–Fri 09:00–17:00, Sat 09:00–14:00). Via Vercel, a synthetic customer booking returned HTTP 201 with a `SAL-` reference, `pending_confirmation` and `awaiting_verification`; the professional could see it and received the in-app booking notification. No payment record existed. The number and encoded WhatsApp link target were checked; WhatsApp was not opened and no message was sent. The test appointment was cancelled afterward. No money or payment was recorded.
- **Payment confirmation:** No live receipt was fabricated or verified. The atomic payment-to-confirmed transition, duplicate/foreign/expired rejection, integer fee validation, and email failure behavior passed in the isolated local backend suite; customer/professional UI confirmation passed in Playwright. A live paid-status change remains intentionally untested until a real external fee is actually received and independently verified.
- **Actual verification:** lint passed; production build passed; backend **45/45**; Playwright **13/13**; `npm audit --omit=dev` reported zero production advisories. Public endpoints and final browser reload had no HTTP 5xx responses. No full test suite is needed beyond these recorded runs.
- **Git/infrastructure:** `c80647e` matches `origin/main`; only the pre-existing unrelated `.gitignore` `.vercel` edit remains uncommitted. No new projects, infrastructure configuration, deployment secrets, or `creatorspace-api` were changed. No further push/deployment is pending.

## Previous live deployment verification (before this local feature)
The existing Render and Vercel health routes had returned HTTP 200; the live synthetic catalog showed eight services and three advertisements; public R2 reads, role logins, and a synthetic create/visible/cancel booking had passed. Those results do not verify the new WhatsApp flow because it has not been deployed. Never reuse exposed passwords or revoked R2 tokens.
---

# Deployment handover — hosted prerequisites in progress (2026-11-18)

- **Credential incident / audit follow-up:** During browser-based configuration, credentials for `salon-render-app-live` and `salon-render-deploy` were inadvertently exposed in a tool result. The Cloudflare audit log now shows three token-create events and three token-revoke events during this setup window. `salon-render-app-live` was created at 09:25:56 and a token-revoke event followed at 09:26:46; the audit event does not include a token name, so exact event-to-token attribution is unavailable. The user manually deleted `salon-render-deploy`. A fresh check confirms both Account API Tokens and User API Tokens lists are empty. No token secret was retrieved during this follow-up. Treat both exposed credentials as revoked/inactive; keep them out of Render, and issue replacements only if needed.
- `69d367c` was pushed to `origin/main` after verifying the existing repository target and checking that the commit contains only `render.yaml` and no credentials. The separate `.gitignore` change remains excluded.
- Atlas project `SalonFlow` has an existing free Cape Town cluster and the `salon_group_app` database user with a custom role limited to `salon_group_demo`. Atlas connection URI/password are not available in the repository or to the agent; database network access is not yet configured for Render.
- Cloudflare R2 activation completed in the account at $0 base/month; overage rates apply above free allowances. Created private Standard bucket `salon-group-media` (no public access). R2 access key/secret are not yet created; do not make the bucket public.
- Existing Vercel project `doug005/salon-management-system` is connected to this repository. Preview alias `https://salon-management-system-sand.vercel.app` serves the UI, but live API requests currently report unavailable/404 because no backend is configured.
- Render Blueprint draft is for a new Free `salon-api` service only; the existing `creatorspace-api` remains untouched. Non-secret values can be re-entered as needed; the draft is not deployed. Atlas URI/password, safe scoped R2 credentials, Render outbound IP allowlisting, additive production indexes and initial admin provisioning remain outstanding.
- No production database data has been seeded or migrated; no hosted backend health/database connectivity is claimed. No tests were rerun as requested.

## Next external steps

1. Create a Cloudflare R2 API token with **Object Read & Write**, restricted to `salon-group-media`; enter the Access Key ID and Secret Access Key directly into the Render secret inputs, never chat.
2. Obtain the Atlas URI for `salon_group_app` and `salon_group_demo`; enter it directly in Render. Add only Render's documented outbound CIDR ranges to Atlas after creating the new service; never use `0.0.0.0/0`.
3. Configure the one-time initial admin setup securely before exposing registration/workflows; remove the setup token immediately after provisioning.
4. Deploy the new Free backend, confirm `/api/health` and production Mongo replica-set/index readiness, then set Vercel `BACKEND_ORIGIN` to that exact HTTPS service URL and verify end-to-end flows.

---

# Urgent handover — service-image test resolved (2026-11-18)

## Current status

- The reported public service-image failure was a flaky browser-test sequence, not a backend permission or media-delivery defect. The test uploaded successfully, then immediately reloaded the public listing before checking the rendered image. It now waits for the upload response, checks the anonymous public service projection and image HTTP response, and renders from the initial public navigation without an unnecessary reload.
- Public checks confirmed `/api/public/services` is unauthenticated, returns the service image URL for a published professional's active service, and the URL returns HTTP 200 with non-empty `image/webp` bytes without credentials.
- The advertisement workflow in the first full rerun also failed once; a targeted retry encountered the already-exhausted process-local login limiter. Restarted only the project-owned demo API (database preserved), added an explicit unpublish response assertion, verified that workflow, then completed the final full browser run.
- Final actual results: `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e` **13/13 passed**; `npm run lint` passed; `npm run build` passed. No runtime downloads, database reset, application rebuild/rewrite, migration or external service was used.
- Git branch is `main`, tracking `origin/main`. The pre-existing `.gitignore` edit (adding `.vercel`) was present before this task and is intentionally not included in the test-fix commit. No remote or repository setting was changed; no push or deployment has occurred.

## Exact next step

Review and commit only `e2e/workflows.spec.js` and this progress update. Keep the existing `.gitignore` change separate. Ask for authorization before pushing to the existing `origin` remote. Continue deployment prerequisites in the requested order; no cloud credentials or provider setup has been verified.

---

# Assignment completion — local implementation and verification (2026-11-17)

## Current status

Phase 8 feature work has been implemented across the existing application; Phase 9 backend verification passes; Phase 10 deployment configuration has been reviewed and updated, but hosting/provider requirements remain unverified; Phase 11 pilot procedures are documented but no real users have participated; Phase 12 documentation is updated. No deployment, purchase, external account or real-user activity occurred.

## Changes implemented

- Professional profile photo upload/preview/replace/remove in Settings; persistent API URL on professional public profile and directory; backend enforces session-derived ownership, image decoding, size/pixel limits, image normalization, published/active public access, and retryable orphan cleanup.
- Service image upload/preview/replace/remove in the service editor; rendered on public services, feature slideshow, professional profile and detail cards; checked public delivery and service-owner enforcement.
- Advertisements support one image or MP4/WebM video, browser preview/playback, correct MIME/container signature checks, 50 MiB upload cap, owner-only replacement/removal, active-publication gating, byte-range playback/seeking, and safe expiry/orphan cleanup. Existing three-active and seven-day rules are preserved.
- Appointment state transitions support professional-only `confirmed → in_progress` during the scheduled interval; in-progress completion; post-end no-show; no rescheduling after scheduled start. Server remains authoritative; UI exposes only available transitions and pending-confirmations now filters correctly. Existing phone/guest booking, registered-customer ownership, slot conflicts, payment verification and historical rules remain intact.
- Compact dashboards now expose hidden role destinations through accessible expandable “More tools”; customer already has “More”. Playwright traversal was adapted to this intended compact navigation.
- Deployment, API, README and pilot docs now cover object storage, uploads, tests, remaining external requirements and role workflows. Added docs/MEDIA_AND_APPOINTMENTS.md.
- Backend integration tests cover image ownership/delivery/removal, video MIME/container/replacement/range/expiry and appointment status transitions. Browser test covers service image upload/public display/removal.

## Actual verification so far

- `npm run lint`: passed after implementation.
- `npm run build`: passed using existing esbuild/Tailwind stack.
- `MONGOMS_RUNTIME_DOWNLOAD=false npm test`: **43/43 passed**.
- `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e`: **13/13 passed** in the complete final run on the isolated synthetic demo.
- Development UI/API were launched against the dedicated synthetic database; no legacy demo database was reset or migrated.
- Initial test run also exposed two shared-slot fixture failures caused by test order/date availability. Tests now configure an explicit common weekday/opening window; re-run full suite to confirm.

## Production and UAT remaining requirements

- No approved Atlas/Render/Vercel/object-storage accounts or credentials are available. Configure `AD_STORAGE=s3`, a private bucket supporting both `advertisements/*` and `business-media/*`, least-privilege ACLs/encryption, and test persistence before deployment. Existing external S3 support is not live-tested. Backend video buffering, 50 MiB cap and hosting timeout/memory need staging review.
- Rate limiting remains process-local; a multi-replica deployment needs a reviewed trusted-proxy configuration and shared rate-limit store. Do not claim production readiness, deployment, actual storage durability or an external service integration.
- The pilot checklist is prepared in docs/PILOT.md. No participants, consent, user feedback or field testing are claimed. Follow it only after owner approval and pilot consent.
- No human-driven mobile/desktop acceptance sessions or formal accessibility certification occurred. Automated responsive browser testing is pending successful final rerun.
- Existing role/ownership migrations, reviewed additive production indexes, backup/restore, legal/privacy copy, verified business details and SMTP remain requiring appropriate authorization/credentials.

## Exact next commands

Reuse the running synthetic demo or check both endpoints first. If the demo is still serving, run:

```bash
cd /home/doug_17/Projects/salon-management-system
npm run lint
npm run build
MONGOMS_RUNTIME_DOWNLOAD=false npm test
MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e
```

Do not reset `.local/multi-professional-data` to fix browser tests. If the synthetic login limiter is exhausted, restart only the project-owned demo/API as already authorized, preserving its database and limits. Inspect browser failures and correct routes/selectors or real defects; do not reduce assertions/rate limits. Update this progress section with final actual outputs before reporting.

---

# Latest work — Google sign-in and installable PWA (partial Milestone 4)

Source changes in this archive were made in a separate development environment, not on the Nobara PC.

- Added optional Google Identity Services login for customers, with Google ID token signature/issuer/audience/expiry/verified-email verification via Google JWKS.
- Existing password accounts (including admin-created professionals) must explicitly link a matching-email Google account while logged in. No public professional signup and no admin Google linking.
- Added PWA manifest, PNG icons, offline application shell service worker, and offline warning. API responses and private data are never cached. **Offline private appointments and offline edits are NOT implemented.**
- Added server/test/google-auth.test.js: 1 passing test covering valid, tampered, wrong-audience, expired, unverified and wrong-issuer tokens.
- Syntax checks passed for modified Node files. Full npm lint/build/browser/integration suites could not run here: npm ci --offline failed with ENOTCACHED (missing mongodb dependency tarball). Re-run on the original PC before merging/deploying.
- No Google Cloud project was configured, no real OAuth login performed, no deployment or external account change occurred.
- See docs/GOOGLE_AND_PWA.md for setup, security limitations, and acceptance checklist.

## Previous Codex progress

# Progress — Milestone 3: dashboard UI redesign

## Current status

All three dashboards are redesigned against the written specification. Final verification: 12 Playwright tests passed in the full run; lint and production build passed. The final targeted customer-history filter check also passed. Stop before offline PWA implementation.

The three referenced dashboard images were not attached to the message or found in the project. Root AGENTS.md also records them as unavailable. No image matching or reference-derived names/data is claimed. The implementation follows the requested system fonts, white/light-gray surfaces, restrained purple accents, compact forms/tables and practical responsive navigation.

Milestone 1 role/ownership and milestone 2 professional-only advertisements remain implemented. Historical milestone 2 status/results are preserved in docs/MILESTONE_2_PROGRESS.md. The authoritative role/payment/advertisement rules in AGENTS.md remain unchanged.

## Completed UI work

- Shared role workspace shell: consistent sidebar/header/content region for admin, professional and customer, active links, one main landmark and page heading, skip link, route focus, mobile toggle state and Escape-to-close/focus return.
- System typography; readable dark text; white/light-gray surfaces; subtle borders; restrained purple actions/focus states; no gradients, glass effects, decorative animation or added UI dependencies.
- Semantic, captioned tables for accounts, services/prices, customers, expenses and overview appointment/activity data. Keyboard-focusable table scroll regions prevent narrow-screen page overflow. Detailed appointment/payment operations remain compact cards with their existing controls.
- Admin overview: real account counts, Add Professional, account management/activation, API/database health, notification mode and platform-scoped recent activity. No advertisement moderation, payment verification or private financial reports.
- Professional overview: Africa/Maseru today's appointments, upcoming active bookings, pending confirmations and customer counts. Dedicated availability, booking, services, customers, payments, expenses/reports, advertisements, business/WhatsApp settings, profile and history navigation. All requests reuse existing ownership-scoped endpoints.
- Customer workspace: upcoming appointments, payment guidance/counts, booking history, payment status, professional browsing, booking within the workspace, appointment management/cancellation, profile and notifications. History defaults to completed records, with a status selector for other history. Eligibility remains enforced by the unchanged server rules.
- Calendar summaries read all pages of the existing appointments API before deriving today/upcoming values. No fabricated statistics, prices, names or financial data.
- Rescheduling inputs now keep a separate value per appointment rather than sharing one value across every card.
- Frontend handles plain-text HTTP 429 responses with clear throttling feedback. Server rate limits were not relaxed.
- Updated README and architecture; added docs/DASHBOARDS.md and dashboard Playwright coverage. Screenshot artifacts are in ignored `.local/dashboard-review/`.

## Commands and actual results

- `npm run lint`: passed (frontend and backend lint). No dependencies installed in this milestone.
- `npm run build`: passed (existing esbuild/Tailwind production build).
- `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e`: **12 passed, 0 failed, 39.4 seconds** on the final full run.
- Browser coverage: all role navigation sections at 1440px desktop and 390px mobile; 320px overview overflow; focus indicators, Escape/menu behavior, semantic headings, runtime/console errors; admin role exclusions; account search/create/activate/deactivate using a newly labelled synthetic professional; unavailable health feedback; mocked login throttling; existing registration, role isolation, service management, manual payment booking/verification/cancellation and advertisement workflows.
- Final affected-route rerun: `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e -- --grep "customer dashboard desktop"`: **1 passed**, including the completed-history filter assertion; final lint/build also passed.
- Actual screenshot review: admin/professional/customer desktop/mobile overviews and populated professional upcoming-booking table. No browser runtime/console errors in the three complete navigation sweeps.
- Backend source/schema/permissions were not modified in this milestone. The previous 39 backend tests passed in milestone 2; that suite was not rerun for this frontend-only change and is not presented as a new result.

## Failures diagnosed and corrected

- React lint rejected reading Date.now directly during render. Overview clocks now use state with a timer effect.
- Visual review found inherited auto margin moving the sidebar brand downward and old mobile sidebar dimensions/positioning. Scoped resets corrected both.
- Updated legacy browser selectors for the new customer heading/navigation and disambiguated success announcements from simultaneous loading status. Assertions still verify real operations.
- Repeated browser runs exhausted the existing development login rate limit (HTTP 429); health remained HTTP 200. Restarted only the isolated demo launcher, preserving its database and limits, then reran successfully. Added explicit UI throttling feedback and a mocked-response test. Authentication helpers clear credentials on failure before generating test artifacts; this run's failure text artifacts were redacted.
- One earlier combined command run ended with exit 143 before the entire browser suite completed; only the final full run above is reported as passing.
- Customer history and current-appointment routes now use separate component keys so the initial completed-status filter cannot inherit the previous route's filter state.

## Data, runtime and safety

Existing source/backend behavior, configuration, databases, accounts, appointments, payments and financial history are preserved. Browser tests added clearly labelled synthetic customer/professional records and synthetic booking/payment records; cancellation preserved their history. No pre-existing account was deleted or reassigned. The original legacy database, multi-professional demo database, private credential files and visual-review archive remain in place.

Frontend runs at http://localhost:3000; API at http://localhost:4000. Only the isolated synthetic demo was restarted to clear in-memory development rate limiting. No production/external service, real email, WhatsApp message, deployment or external account change occurred. SMTP remains safe mode. No Vite/framework/dependency change was introduced. No Git metadata exists in this directory; no commit was created.

## Known limitations / next priority

1. Reference-image comparison is blocked by the missing three images. The written design specification has been implemented; do not claim pixel/reference fidelity.
2. Calendar overviews fetch all own appointment pages for accurate dates; very large histories would benefit from a future scoped backend aggregate endpoint. Upcoming tables show the next 10 entries and link to full management lists.
3. Keyboard/semantic/responsive checks are executed; this is not a formal screen-reader/WCAG certification.
4. Prior external setup remains: authorised production S3/Atlas/SMTP verification, reviewed legacy ownership mappings/backfill/index transitions. No production-readiness claim.
5. **Next implementation milestone is basic offline PWA support, only when authorised. It has not been started.** Preserve online booking conflict checks and manual-payment verification; never cache credentials or private financial API responses.

## Exact resume instruction and commands

Read AGENTS.md, this PROGRESS.md, docs/FINAL_ARCHITECTURE.md and docs/DASHBOARDS.md. Milestone 3 is the stopping boundary. On a new authorised task, either compare the three supplied reference images or proceed with the requested offline PWA milestone. Preserve roles, professional isolation, admin financial restrictions, professional-only seven-day advertisements, manual payments, esbuild, Africa/Maseru and integer lisente.

```bash
cd /home/doug_17/Projects/salon-management-system
curl --fail --silent http://localhost:3000/ --output /dev/null
curl --fail --silent http://localhost:4000/api/health
# Reuse healthy listeners. If both are stopped:
MONGOMS_RUNTIME_DOWNLOAD=false npm run demo
# If only one component is stopped, start only that component:
npm run dev -w client
MONGOMS_RUNTIME_DOWNLOAD=false npm run demo -w server
# Relevant checks after changes:
npm run lint
npm run build
MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e
# For backend changes:
MONGOMS_RUNTIME_DOWNLOAD=false npm run check
```

Do not repeatedly rerun authentication suites against an already-throttled development process or weaken rate limits. Inspect HTTP status, wait or restart only the project-owned synthetic demo when necessary. Never print the ignored `.local/multi-professional-accounts.json`, reset databases, deploy or contact real services without authorisation.

## CreativeStudio-inspired navigation and discovery update (2026-11-17)
- Reworked the public navigation to Home, Services and Login/My studio, with no separate About navigation or About route; the introduction is on the long-scrolling homepage.
- Added a full-width editorial hero and sections for advertisements, services, business story, and professional profiles on the homepage.
- Consolidated customer and professional sidebar links to primary destinations; less frequent routes remain in the expandable All tools section.
- Added CreativeStudio-inspired top navigation to authenticated workspaces.
- Unified public and customer-workspace professional cards using image-first numbered discovery layouts.
- Retained Arial/Helvetica for all headings and body copy.
- This is a screenshot-informed implementation. CreativeStudio source components could not be fetched directly in the execution environment, and browser tests/build must be run on the user's machine.

## Final browser verification update

- `MONGOMS_RUNTIME_DOWNLOAD=false TMPDIR="$PWD/.local/tmp" npm run test:e2e`: **13 passed, 0 failed** in a full run.
- Coverage passed for admin, professional and customer desktop/mobile workspaces, compact/expanded navigation, account isolation, public registration, payment verification/cancellation, mobile role settings separation, service image upload/preview/public rendering/removal, and advertisement image lifecycle/public mobile display.
- The isolated synthetic demo process was restarted only to clear process-local login throttling; the synthetic database, credentials file and legacy database were preserved.
- No real user feedback, real email, real payment, deployment or external provider integration is represented by this browser result.
