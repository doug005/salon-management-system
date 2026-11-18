# Salon Management System — Group Testing Preview

> Testing environment only. The identities and services below are fictional demonstration data. Do not use real payment details or enter sensitive personal information.

## Preview

No public preview URL has been created yet. This project has not been deployed or authorized for public hosting. After public deployment approval, replace this section with the verified `*.vercel.app` URL.

## Demo accounts

| Role | Name | Email | Password |
|---|---|---|---|
| Administrator | Mpho Mokoena | admin@salondemo.example | Retrieve locally with `npm run demo:credentials` |
| Professional | Lerato Thabane | lerato@salondemo.example | Retrieve locally with `npm run demo:credentials` |
| Customer | Neo Rasebetsi | neo@salondemo.example | Retrieve locally with `npm run demo:credentials` |

Passwords are not stored in this document or source files. They are stored only in ignored `.local/group-demo-credentials.json` with mode `0600` on the development workstation. Do not copy them into screenshots or issue reports.

## Features to test

- Register a separate synthetic customer or use Neo's account.
- Browse Lerato Beauty Studio and the eight fictional salon services.
- Create, reschedule or cancel appointments.
- Test guest/phone-style booking where available.
- Record and independently verify a synthetic manual payment.
- Check professional customer isolation and role restrictions.
- Test profile photo and service image preview/upload/removal.
- Inspect the Braids Special, Weekend Beauty Package and Nail Care Promotion advertisements.
- Test advertisement image/video replacement and expiry behavior.
- Test desktop and mobile navigation and logout.

## Manual payment testing

This is not a live payment system. Use fictional receipt references only. A professional must independently verify or reject the manually recorded test payment. Do not enter bank details, PINs or real receipts.

## Bug reporting

Send the following:

1. Your role and browser/device.
2. The steps attempted.
3. Expected and actual behavior.
4. Screenshot only if it contains no password or sensitive data.
5. The date/time in Africa/Maseru.

Do not report an issue until you have refreshed the page and noted the exact message.

## Known limitations

- No real participant feedback or pilot acceptance has occurred.
- Google login, SMTP and video delivery require separate hosting/provider configuration.
- Persistent object storage is not live-configured until approved credentials are supplied.
- Rate limiting is process-local until a shared store is configured.
- Public deployment, DNS, Atlas and hosting require credentials and explicit approval.
- This environment contains clearly labelled fictional records and generated promotional artwork.

## Custom domain

After the preview is verified, the owner may configure a custom domain in Vercel and update `CLIENT_ORIGIN` on the backend. Keep API origin and cookie settings aligned. Do not add DNS or external accounts until deployment approval.
