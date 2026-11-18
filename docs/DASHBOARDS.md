# Dashboard interfaces — milestone 3

## Design and scope

All three workspaces share a system-font sidebar, header, main content landmark, white/light-gray surfaces, subtle borders and restrained purple accents. No framework or dependency was added. No backend route, permission, financial logic or database schema changed in this milestone. Reference images were not attached or found in the project; the implemented design follows the written brief and does not claim image matching.

## Role navigation

Admin `/admin`: overview counts, Add Professional, account search/table with activation/deactivation, shared settings, platform audit, notifications and personal profile. Health comes from `/api/health`, activity from the platform-scoped audit API. Unavailable health is displayed as an error rather than fabricated uptime. No advertisement moderation, payment verification or private financial navigation is provided.

Professional `/professional`: today’s appointments (Africa/Maseru), next ten upcoming active bookings, pending confirmations, services/prices, customers, payments, expenses, reports, availability, advertisements, booking, business/WhatsApp settings, notification/audit history and personal profile. Calendar summaries read all pages of the existing own-appointments API before filtering/sorting, avoiding an inaccurate summary from just the first page. Large histories may therefore require several requests; a future backend aggregation endpoint could improve performance without changing the ownership rules.

Customer `/account`: overview, My appointments, Booking history, Payment status, Browse professionals, Book a service, Account settings and notifications. History initially selects completed appointments; its status selector also provides cancelled/no-show/all records. Appointment actions reuse server-enforced eligibility rules and display denial reasons. Manual payment instructions explain that only the professional independently verifies receipt. No offline confirmation or gateway exists.

Account, service, customer and expense management use semantic tables with captions and column headers. Appointment/payment workflows retain compact detail cards for policy text, rescheduling and verification controls. Overview appointments use compact tables. Tables scroll inside their region on small screens rather than widening the page.

## Keyboard and responsive behaviour

- One main landmark and one page-level heading per workspace route.
- Skip link targets the main region. Route navigation moves focus to that region.
- Mobile toggle exposes expanded state and the controlled sidebar ID; hidden navigation is not focusable.
- Escape closes mobile navigation and returns focus to the toggle; selecting a navigation link closes the menu.
- Visible purple focus outlines; native labels, buttons, selects and inputs; statuses always have text as well as color.
- Desktop 1440px, mobile 390px and narrow 320px layouts are checked by Playwright. Every role section is visited at desktop/mobile widths.

## Verification and artifacts

Tests live in `e2e/dashboards.spec.js` and `e2e/workflows.spec.js`. They cover navigation, overflow, focus/Escape, role exclusions, platform health error, account search, synthetic professional creation/activation, login throttling feedback, booking/verification/cancellation and advertisement lifecycle. All data used is synthetic. No WhatsApp message or email is sent.

Current screenshots are stored in ignored `.local/dashboard-review/`:

- admin-desktop.png / admin-mobile.png
- professional-desktop.png / professional-mobile.png
- customer-desktop.png / customer-mobile.png
- professional-upcoming-desktop.png (created by the populated booking workflow)

These are captured application screenshots, not design references. Authentication helper failures clear credential form fields before Playwright artifacts are generated. See PROGRESS.md for actual executed results and known limitations. This is functional/visual/keyboard verification, not a formal screen-reader or WCAG certification.

Offline PWA work is outside this milestone.
