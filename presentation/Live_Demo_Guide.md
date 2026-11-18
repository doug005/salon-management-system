# Live Demonstration Guide

## Safety and preparation

- Use only the isolated local multi-professional synthetic demo. Do not log in to the hosted Vercel/Render deployment for this presentation.
- Existing demo credentials are stored in the ignored, mode-restricted `.local/multi-professional-accounts.json`. Do not paste, print, screenshot, record, or commit them. Do not use any real professional/customer account.
- Demo services, customer identities, appointments and receipts are synthetic. Do not describe them as partner activity or real transactions.
- Do not use WhatsApp to contact a real phone number. A browser popup can be intercepted or the relevant destination/message can be inspected without sending; then close the popup.
- No payment gateway exists. Do not record a real receipt. A synthetic test receipt is not evidence that money was received.

## Start and confirm local services

From the repository root, run the established local demo launcher with MongoDB binary downloads disabled. Wait until it reports the isolated demo and both services ready. Confirm the local frontend and `/api/health` respond successfully. The demo uses its existing `.local/multi-professional-data` database; do not reset it.

If the credentials file is missing, use the repository's existing synthetic demo bootstrap process only. Do not run any account-provisioning script against Atlas or the hosted backend.

## Six-minute online demo path

1. **Public discovery (45 sec):** show the public service list and professional profile. Explain that only published professional-entered information is shown. Any demo prices/photos are synthetic or illustrative.
2. **Customer request (60 sec):** sign in with the synthetic customer; choose a synthetic professional/service/time and accept the displayed policy. Show the confirmation prompt and pending booking reference.
3. **Customer → professional handoff (30 sec):** open or inspect the encoded WhatsApp link. Confirm it targets the selected synthetic professional. Do not press Send; close the chat tab.
4. **Professional appointments (60 sec):** sign in as the matching synthetic professional. Search the booking reference. Show pending state, customer contact snapshot, service, date, and booking fee.
5. **Record and verify (90 sec):** use an explicitly synthetic receipt reference. The professional records the test receipt as awaiting verification, then checks the confirmation control and verifies it as synthetic demo data. Show the appointment moving to Confirmed and payment to Paid. Make clear this UI action is only a demo and no money was received.
6. **Professional → customer handoff (30 sec):** inspect the customer-directed link and confirm it targets the customer number saved for that booking, not the professional’s number. Do not press Send.
7. **Mobile / offline (45 sec):** show the responsive customer view. For offline, use browser DevTools/network emulation after the shell has loaded; show the offline indicator/fallback and public cached content if it is available. Booking and payment actions must be described as online-only. Restore connectivity after the check.

## Offline fallback plan

If network emulation fails or cached content is unavailable, state that it requires a first successful online load and demonstrate the static fallback page only. Do not claim that private records or offline booking synchronization works.

## If the demo fails

- Do not switch to a real hosted account or database.
- Use the embedded genuine screenshots in the slide deck and explain the local issue.
- Avoid repeated authentication attempts; the local auth limiter can throttle repeated logins.
- Do not expose credentials in a recording, screenshot, terminal output, or presentation.
