# Customer-experience defect resolution plan

## Scope
Resolve the confirmed findings in the uploaded customer experience audit while preserving the existing role/ownership, manual-payment, notification, and mobile architecture. The public surface must never present synthetic services, prices, promotions, contacts, or imagery as real.

## Design
Three possible directions: (0.05) editorial salon brochure, (0.08) transactional booking-first layout, (0.87) restrained trust-first service desk. Choose the trust-first service desk: plain white/light-gray surfaces, restrained purple accents, explicit verification states, strong focus/keyboard affordances, and clear status language.

Core principles: verified facts first; fail closed when data is missing; let visitors explore availability before account creation; preserve state across authentication; distinguish request/payment/confirmation statuses; never imply email/payment/portfolio capability that is not configured.

## Project structure

The React public shell, routes, booking flow, authentication forms, localization, media fallback, and responsive styles live under `client/src`. Express route composition and auth/session policy live in `server/src/app.js` and `server/src/auth.js`; tenancy/public serialization is in `server/src/tenancy.js`; Mongoose public/private record shapes are in `server/src/models.js`; service and promotion publication gates live in `server/src/validation.js`, `server/src/advertisements.js`, and `server/src/business-media.js`. Existing `server/test` integration tests and `e2e` Playwright workflows remain the verification surface. `render.yaml` and `vercel.json` are preserved as the existing deployment declarations; no replacement infrastructure is introduced.

Color philosophy: keep the existing restrained purple/neutral palette, using amber only for pending verification and red only for actionable errors. Layout: preserve the existing content hierarchy but give booking controls priority and keep the verified address in the footer/profile contact area. Signature elements: an explicit “verified salon information” label, address/directions block without a fabricated map, and a compact booking-status explainer.

Interaction: public visitors can choose professional, service, date, and slot before sign-in; submitting while signed out stores a short-lived booking draft and routes to login/register with a return URL; authenticated booking restores the selection. Loading states include retry controls and error messages. Mobile controls meet comfortable touch targets.

Brand essence: “Makatleho Beauty Palour — verified information before you book”; personality: careful, local, straightforward. Voice examples: “Choose a time before you create an account.” and “Service details will appear here after the salon verifies them.” Use the existing wordmark treatment; do not generate a logo or synthetic salon photography.

## Implementation shape
- Backend: public serialization/public queries, service/ad verification gating, safe public salon identity/address, email delivery status handling, and tests.
- Frontend: booking draft and auth return flow, public verified-data states, footer/address/contact treatment, loading/retry states, translations, touch target CSS, and non-portfolio image fallback.
- Tests: targeted backend/public filtering and email delivery assertions plus focused browser booking-state/auth navigation checks; then full lint/build/test suites.
- Delivery: commit only intended changes, push existing `main`, and use the already connected deployment services. Missing provider-side SMTP/database/media credentials remain blockers rather than reasons to invent configuration.
