# Google sign-in and offline shell (Milestone 4 partial implementation)

## Google login

Create a Google Auth Platform **Web** OAuth client, with the real HTTPS site origin (and `http://localhost:3000` for development) in Authorized JavaScript origins. Set `GOOGLE_CLIENT_ID` in `server/.env` and `PUBLIC_GOOGLE_CLIENT_ID` in `client/.env` to the same client ID. No client secret is needed for Google Identity Services ID-token sign-in. Both values are optional; Google controls are hidden until configured. Do not commit real environment files.

Customer Google sign-in creates **customer** accounts only. Existing password users must first sign in with their password and link a matching-email Google account on the **Profile** page. Admin-created professionals follow this same link flow. Admin accounts cannot link Google. Existing emails never get silently linked. Backend verifies Google JWKS signatures, issuer, audience, expiry and verified email, and enforces active status and existing session boundaries.

Google authentication requires internet. Google account linking is intentionally unavailable to users who cannot first sign in with their existing password. For professionals with a lost password, use the existing approved administrator recovery process; do not manually edit database roles or Google subjects.

## Installable PWA

`client/public/manifest.webmanifest`, PNG icons and `sw.js` enable installation from a **deployed HTTPS origin** (or localhost during development). Android browsers generally offer Install; on iOS, use Safari's Share → Add to Home Screen. Test on real devices, as browser/OS versions vary.

**Offline scope currently delivered:** cached application shell/assets only. The service worker NEVER caches `/api` responses, JWTs, customer details, private appointments or payment records. The interface shows an offline warning; authenticated API operations remain online-only. Offline viewing of private appointments and secure queued edits **are not implemented** and must not be claimed. A secure offline-record design needs an explicit user unlock/consent policy, device storage threat model, expiry/revocation rules and conflict tests. iOS background sync is not reliable; future sync should occur on foreground reconnection.

## Required acceptance checks

- Run `npm ci`, `npm run check`, `npm run build`, and browser tests with a local synthetic MongoDB and cached Playwright browsers.
- Test Google customer creation, password-account conflict, existing-professional linking, foreign-email rejection, duplicate subject, disabled account and token tampering with real configured Google OAuth credentials (or controlled integration test doubles).
- Test HTTPS PWA install and offline shell on current Android and iOS hardware; confirm no private data is present in Cache Storage.
- No real Google Cloud project, deployment or external account was changed in this development workspace.
