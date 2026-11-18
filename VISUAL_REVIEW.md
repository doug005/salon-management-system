# Salon Management System — visual review

Review date: 17 November 2026. Browser: Chromium 159.0.8154.6 through Playwright. Desktop viewport: 1440 × 1000; phone viewport: 390 × 844; device scale factor 1; locale en-LS; timezone Africa/Maseru. All normal page captures are full-page PNGs. The additional scrolled chart image is intentionally a focused component capture.

## Outcome

The requested public, customer, owner and permitted staff pages were reached and captured. The final healthy traversal produced **70 full-page screenshots with no phase failures**; the package contains **76 PNGs** including additional keyboard, validation, chart and outage evidence. **14 primary workflow/navigation checks passed. Two additional keyboard checks failed:** Escape did not dismiss either mobile menu. There were **0 uncaught browser JavaScript exceptions** in the final healthy traversal, no detected broken images and no document-level horizontal overflow at the two tested widths.

The design is cohesive and usable for a demonstration, with a consistent cream/sage palette, clear serif headings, responsive cards, readable service prices and explicit manual-payment wording. This is not an accessibility certification, a production-readiness declaration, or evidence of real financial transactions.

No application feature/source code, service, staff, settings, expense or payment record was edited for this review. UI-only edit forms were opened and cancelled. Registration and booking interactions used synthetic demonstration data only: review accounts were created, temporary review holds were rescheduled and then cancelled, and their slots were released. No payment was recorded or verified during this review. Pre-existing Paid rows in screenshots are synthetic records from earlier development tests.

## Local environment and operational observations

- Website: http://localhost:3000. API: http://localhost:4000/api/health. Both were checked locally; the API reported `emailMode: safe` and the business was explicitly marked as demonstration data.
- Existing frontend was reused. The API became unavailable during prolonged capture/diagnostic passes. Local connection attempts were refused; the frontend proxy returned 502 and some protected routes redirected to Login. Healthy captures were repeated after restart; the outage image is separately labelled. The reason the prior launchers exited was not established, so this report does **not** claim an application crash or a diagnosed root cause. The API was subsequently started in a detached local process.
- **External-network exception:** restarting the existing demonstration launcher unexpectedly triggered its automatic MongoDB 7.0.24 binary download. This violated the intended no-external-services restriction and should have been prevented by disabling runtime downloads before launch. It is recorded here rather than claiming complete network isolation. No application feature was changed to enable the download. Subsequent diagnostic invocation used `MONGOMS_RUNTIME_DOWNLOAD=false`.
- Browser request routing allowed only localhost/127.0.0.1 ports 3000/4000 and in-memory data/blob URLs. No off-host browser requests occurred in the recorded runs. WhatsApp links were not followed, and no real emails, customer messages, payment-provider calls or deployments occurred.

## Coverage

| Area | Captured states |
| --- | --- |
| Public desktop | Home, About, Services, guest Book Appointment, Contact, Login, Register, Not Found; keyboard skip-link focus and required-field validation |
| Authentication | Empty and filled/redacted Login/Register; invalid login feedback; registration success and logout |
| Customer | Dashboard, payment history, profile/password form, notifications, cancelled appointment history, active booking policy, rescheduled hold and cancelled review hold |
| Booking | Guest sign-in prompt, authenticated empty form, service/staff/date/available time, fee/total/policy acceptance, request received with Awaiting Payment |
| Owner | Overview, Appointments, Services, Customers, Staff, Payments, Pending Confirmations, Expenses, Reports, Settings, Notifications, Audit history, Profile |
| Owner interactions | Search empty state, cancelled-status filter, populated service edit form followed by Cancel editing, monthly report range and CSV action |
| Staff | Overview, assigned Appointments, Customers, Services, Payments, Pending Confirmations, Notifications, Profile; direct owner-only Settings route denial |
| Mobile | Home, Services, Contact, Login/Register, guest/customer booking, customer account/profile, owner overview/appointments/payments/pending/reports/settings/menu, staff overview/appointments/customers |
| Diagnostics | Escape dismissal for both menus, mobile chart after scrolling into view, separately labelled API outage/login redirect |

## Findings and suggested improvements

Priority P1 = address before real-user pilot; P2 = important usability/accessibility work; P3 = polish. Findings are **reported, not fixed**, as requested.

### VR-01 — P1: Reschedule draft is shared between appointment rows

On the customer account page, entering a new time for the review hold also populated the reschedule field on another active appointment. The repeated date is visible in the [rescheduled-hold capture](review/screenshots/desktop-customer-rescheduled-hold.png). Source inspection confirms that one `reschedule` state value is reused across the record list. The review submitted only the intended hold, so the other appointment was not altered.

Risk: a user may click Reschedule on the wrong row and submit the draft intended for another visit. Store a draft per appointment ID or use a single clearly identified rescheduling dialog; show booking reference/current/new time before final submission.

### VR-02 — P1: Secondary/policy text needs stronger contrast

A computed-style contrast screen found candidates on **34 of the 70 page/state captures**. Repeated examples against the nearest opaque background include:

| Example | Observed ratio | Screening threshold |
| --- | --- | --- |
| Footer secondary text, `#6b746b` on `#eaece3` | about 4.06:1 | 4.5:1 for normal text |
| Demonstration disclaimer, `#777c68` on `#f8f7f2` | about 4.02:1 | 4.5:1 |
| Secondary text on light policy panels | about 4.20:1 | 4.5:1 |
| Small service-card numbering | about 3.50:1 | 4.5:1 |

See [Home](review/screenshots/desktop-public-home.png), [Services](review/screenshots/desktop-public-services.png) and [booking policy](review/screenshots/desktop-booking-policy-and-slot.png). Darken secondary text, especially policy/disclaimer text, and increase very small labels. Decorative text within the illustrated hero has a pale-on-pale candidate too, but is not treated as a confirmed essential-text failure.

These are screening measurements, not a full WCAG audit: the heuristic uses computed foreground and nearest opaque ancestor background and does not fully model overlapping artwork, alpha composition or every rendering condition.

### VR-03 — P2: Mobile menus do not dismiss with Escape

Both explicit Escape checks reproduced an expanded menu after the keypress. The administration drawer measured approximately 911px tall against an 844px phone viewport; its underlying content remains visible and it has no modal declaration. See [public menu after Escape](review/screenshots/mobile-navigation-after-escape.png) and [admin menu after Escape](review/screenshots/mobile-admin-navigation-after-escape.png).

Choose a coherent disclosure or modal-drawer pattern. Support Escape and sensible focus return; if modal, add appropriate dialog semantics, background inertness, focus containment and internal scrolling. Ensure Log out and lower links remain easy to reach. Clicking navigation items did work and closed the menu.

### VR-04 — P2: Administration lacks a main landmark

The DOM screen found no `main`/`role="main"` in **36 owner/staff captures**. The content has an `id="main"` on a div, which is not itself a main landmark. Public pages do contain a main element. Replace the admin content container with `main` or assign its role; validate skip-link destination/focus behavior with a screen reader.

### VR-05 — P2: Heading hierarchy skips levels

Dedicated Services and several appointment/notification/audit lists jump from h1 directly to h3 record headings. Use an h2 section/list heading or adjust record headings for the dedicated page context. This does not break the visual layout but makes structured navigation less predictable.

### VR-06 — P2: All pages share one browser title

Every normal capture reported `The Salon · Lesotho`, including Login, Reports, Settings and Not Found. Use descriptive route-aware titles with the configured salon name so browser tabs, history and assistive announcements distinguish tasks.

### VR-07 — P2: Customer Payments uses staff-facing instructions

The [customer Payments page](review/screenshots/desktop-customer-payments.png) tells the reader to record external payments and confirm independently checked funds, although customer recording/verification controls are correctly absent. This is misleading financial guidance, not an observed permission bypass. Replace it with customer-specific text explaining that the salon records and verifies payments and how customers obtain assistance.

### VR-08 — P2: API outages resemble an authentication failure

When the API disappeared, protected pages showed Login and public branding could fall back to generic text. [Outage evidence](review/screenshots/mobile-api-outage-login-redirect.png) shows this separately from healthy dashboard captures. Distinguish network/service failure from invalid/expired authentication, retain a clear retry/recovery banner, and avoid silently presenting an unexplained sign-in state. Investigate the launcher lifetime separately; this review did not change server feature code.

### VR-09 — P2: Mobile operations require excessive scrolling and mixed money units

The [mobile Settings form](review/screenshots/mobile-owner-settings.png) and [mobile Reports](review/screenshots/mobile-owner-reports.png) fit horizontally, but are very long. The settings description uses a single-line input, so longer content requires horizontal caret navigation. Consider grouped/collapsible sections, a multiline description, clearer save feedback and an accessible sticky action where appropriate.

Payment/service/settings forms use integer lisente while cards use M, and the chart axis uses lisente. Labels are explicit, but entering 50 instead of 5000 is an avoidable operational risk. Offer a live M conversion/preview or M-entry control that converts to integer lisente internally; make chart units consistent or show both clearly.

### VR-10 — P2: Selected customer section is visually subtle

Customer section buttons communicate `aria-pressed` but use nearly identical visual styling, and their labels remain lower-case internal-looking names. Add a strong visible selected state and consistent user-facing labels; consider a coherent tab/tabpanel pattern if tabs are the intended interaction.

### VR-11 — P3: Form/help copy and empty states can be clearer

The login/register footer exposes access-token/HttpOnly implementation details and password guidance uses UTF-8 byte terminology. Keep user help task-focused; explain unusual password-length rejection in plain language. The empty pending-confirmations page correctly says no records, but could explain that only recorded, unverified payments appear. Empty expense-category/report sections could use short explanatory messages instead of bare headings.

Cancellation immediately changed the review hold with one click. A reference-specific confirmation or safe undo flow would reduce accidental cancellation. Closed-day time fields remain editable-looking when their Open checkbox is unchecked; disabling/dimming them would clarify that they are ignored.

### VR-12 — P3: Compact typography and native date presentation

Some badges/eyebrows are around 8–10px and footer text 10–12px. Increase secondary sizes where information matters, and review small link/checkbox targets with their actual label/spacing hit areas. A small DOM box alone is not treated as a target-size compliance failure because label and spacing exceptions can apply.

The tested Chromium native date fields displayed month/day/year, while appointment summaries use a day-month textual format. Add an unambiguous human-readable selected-date preview and test actual target-device locale behavior. Timezone labels and displayed appointment times remained explicitly Africa/Maseru.

## Layout and responsive assessment

- **Public:** balanced desktop hero, prominent booking CTA, attractive local CSS illustration and consistent spacing. On phone, content stacks without measured overflow and navigation expands correctly. Two active demo services leave a spare desktop grid column; consider auto-fitting if the real catalogue is small.
- **Authentication:** labels, required inputs, focus ring and generic invalid-login alert are visible. Native required-field checks prevented empty registration. Filled identifiers/passwords are intentionally masked in this package; grey boxes are redactions, not missing controls.
- **Customer/booking:** service duration, price, booking fee, total, policy and hold status are present. Booking-request success explicitly remains Awaiting Payment. Status badges include words rather than relying on colour alone. History and policy disclosure render correctly; long card lists could be denser on desktop.
- **Owner/staff:** sidebar labels and selected navigation are readable; role-specific access worked. Settings and management forms render on desktop and phone. Staff cannot open owner Settings. Pending confirmations and Expenses were captured in their genuine empty states; the review did not invent payments/expenses to populate them.
- **Reports:** cards distinguish received income from booked value. Date presets and CSV generation work. The mobile chart's initial offscreen full-page captures showed axes without the bar, while DOM bounds existed; after scrolling the chart into view the bar painted correctly. See the [scrolled chart detail](review/screenshots/mobile-owner-income-chart-scrolled.png). Treat this as a capture/visibility rendering caveat, not confirmed missing financial data or a permanently broken chart. Include a tabular chart alternative and continue real-device checks.
- **No broken image assets** were detected in the reviewed states. Service image URLs are not configured in the synthetic catalogue; this does not validate the optional remote-image path.

## Interaction results

| Check | Actual result |
| --- | --- |
| Desktop requested routes/deep links and public Not Found | Loaded and captured |
| First keyboard Tab reaches skip link | Passed |
| Empty registration validation | Passed; required fields blocked submission |
| Customer login and reload persistence | Passed |
| Synthetic registration and logout | Passed |
| Invalid synthetic login | Passed; generic alert, no account disclosure |
| Available-time selection and policy acceptance | Passed |
| Synthetic booking request | Passed; Awaiting Payment, not confirmed |
| Review-hold reschedule and cancellation | Passed; only newly created review holds submitted |
| Customer history/payment/profile/notification sections | Loaded and captured |
| Customer unmatched search | Passed; explicit empty state |
| Appointment status filtering | Passed |
| Service populated edit form and Cancel editing | Passed; no service write |
| Monthly report date preset and CSV action | Passed; generated download not retained |
| Desktop Reports/Settings sidebar navigation | Passed |
| Staff owner-only Settings route | Passed; Access restricted |
| Mobile public/admin item navigation | Passed |
| Mobile public/admin Escape dismissal | **Failed, both menus remained expanded** |
| Chart after scrolling into viewport | Visible bar confirmed in focused screenshot |

The 12 checks recorded by the main healthy harness and two additional login/sidebar checks passed. Supplemental keyboard checks found the two failures above. Chart DOM/paint checks were diagnostic evidence, not a substitute for validating financial calculations.

## Console, network and availability

The final healthy traversal recorded **0 uncaught page exceptions**, **21 console error entries**, and **21 HTTP error responses**. All of those HTTP errors were unauthenticated `/api/auth/refresh` responses with status 401, corresponding to the same browser resource-error entries. Guest contexts intentionally have no refresh cookie; these are expected session probes, not 21 broken pages. No other application warning/error class appeared in that healthy traversal.

The deliberate invalid-login check also produced an expected 401. Supplemental new contexts had the same unauthenticated refresh probes. Earlier interrupted passes produced genuine 502 proxy responses while the API was offline; those are not hidden in the healthy-run totals and are documented separately above. There were no off-host browser requests in the recorded runs.

## Accessibility review limits

The DOM screen found labelled visible inputs/selects/textareas and one visible h1 per normal page state. Keyboard skip-link focus, required validation and role denial were exercised. Contrast candidates, landmarks and heading order were inspected, but no axe package was installed and no external service was contacted to obtain one. This was not a full screen-reader audit, WCAG conformance test, cross-browser test or real-device trial. Only the two stated viewport widths were measured; smaller phones/tablets, zoom/reflow, high contrast and reduced-motion interaction need follow-up.

## Privacy and package contents

- Filled account/contact/password fields were masked before PNG capture. Account names/emails, database IDs and booking/payment identifiers were replaced with redacted labels in the browser; the DOM was restored after each screenshot.
- Demonstration service names, public policy text, generic role names, dates and aggregate synthetic amounts remain for visual context. They are not real customer or payment outcomes.
- Redaction can slightly change text wrapping. It does not represent an application feature change.
- The ZIP allowlist contains **only this report and PNG files under `screenshots/`**. It excludes `.env`, account files, source code, review scripts, JSON diagnostics, server logs, storage state, cookies, bearer tokens, browser traces, raw HTTP bodies/headers, downloads and unrelated project files.
- Review-only code/diagnostics remain outside the ZIP for local reproducibility. No credentials or personal information are intentionally included.

## Recommended next steps

1. Before a real pilot, isolate reschedule drafts by booking and improve policy/disclaimer contrast.
2. Add admin main landmarks, sensible heading hierarchy, distinct titles and keyboard-complete mobile navigation.
3. Correct role-specific payment instructions and improve API-unavailable recovery messaging.
4. Simplify mobile operational forms, money entry and selected account-section styling; preserve clear manual-verification controls.
5. Repeat real-device/screen-reader checks and inspect long-session server supervision. Keep runtime dependency downloads disabled for offline-only review runs.

No suggested application fixes were applied during this review.

## Screenshot inventory

Every link below points to a packaged PNG. The normal captures include complete page height, rather than only the initial viewport. `mobile-owner-income-chart-scrolled` is the extra focused chart diagnostic; `mobile-api-outage-login-redirect` is historical outage evidence, not a healthy owner screen.

- [desktop-booking-empty](review/screenshots/desktop-booking-empty.png)
- [desktop-booking-policy-and-slot](review/screenshots/desktop-booking-policy-and-slot.png)
- [desktop-booking-request-received](review/screenshots/desktop-booking-request-received.png)
- [desktop-customer-active-booking-policy](review/screenshots/desktop-customer-active-booking-policy.png)
- [desktop-customer-appointment-history](review/screenshots/desktop-customer-appointment-history.png)
- [desktop-customer-cancelled-review-hold](review/screenshots/desktop-customer-cancelled-review-hold.png)
- [desktop-customer-dashboard](review/screenshots/desktop-customer-dashboard.png)
- [desktop-customer-login-filled-redacted](review/screenshots/desktop-customer-login-filled-redacted.png)
- [desktop-customer-notifications](review/screenshots/desktop-customer-notifications.png)
- [desktop-customer-payments](review/screenshots/desktop-customer-payments.png)
- [desktop-customer-profile](review/screenshots/desktop-customer-profile.png)
- [desktop-customer-rescheduled-hold](review/screenshots/desktop-customer-rescheduled-hold.png)
- [desktop-login-invalid-credentials-redacted](review/screenshots/desktop-login-invalid-credentials-redacted.png)
- [desktop-login-keyboard-focus](review/screenshots/desktop-login-keyboard-focus.png)
- [desktop-owner-appointments-filter-cancelled](review/screenshots/desktop-owner-appointments-filter-cancelled.png)
- [desktop-owner-appointments](review/screenshots/desktop-owner-appointments.png)
- [desktop-owner-audit](review/screenshots/desktop-owner-audit.png)
- [desktop-owner-customer-search-empty](review/screenshots/desktop-owner-customer-search-empty.png)
- [desktop-owner-customers](review/screenshots/desktop-owner-customers.png)
- [desktop-owner-expenses](review/screenshots/desktop-owner-expenses.png)
- [desktop-owner-notifications](review/screenshots/desktop-owner-notifications.png)
- [desktop-owner-overview](review/screenshots/desktop-owner-overview.png)
- [desktop-owner-payments](review/screenshots/desktop-owner-payments.png)
- [desktop-owner-pending-confirmations](review/screenshots/desktop-owner-pending-confirmations.png)
- [desktop-owner-profile](review/screenshots/desktop-owner-profile.png)
- [desktop-owner-reports-month-filter](review/screenshots/desktop-owner-reports-month-filter.png)
- [desktop-owner-reports](review/screenshots/desktop-owner-reports.png)
- [desktop-owner-service-edit-unsaved](review/screenshots/desktop-owner-service-edit-unsaved.png)
- [desktop-owner-services](review/screenshots/desktop-owner-services.png)
- [desktop-owner-settings](review/screenshots/desktop-owner-settings.png)
- [desktop-owner-staff](review/screenshots/desktop-owner-staff.png)
- [desktop-public-about](review/screenshots/desktop-public-about.png)
- [desktop-public-booking-guest](review/screenshots/desktop-public-booking-guest.png)
- [desktop-public-contact](review/screenshots/desktop-public-contact.png)
- [desktop-public-home](review/screenshots/desktop-public-home.png)
- [desktop-public-login](review/screenshots/desktop-public-login.png)
- [desktop-public-not-found](review/screenshots/desktop-public-not-found.png)
- [desktop-public-register](review/screenshots/desktop-public-register.png)
- [desktop-public-services](review/screenshots/desktop-public-services.png)
- [desktop-register-filled-redacted](review/screenshots/desktop-register-filled-redacted.png)
- [desktop-register-validation](review/screenshots/desktop-register-validation.png)
- [desktop-registration-success-empty-account](review/screenshots/desktop-registration-success-empty-account.png)
- [desktop-staff-appointments](review/screenshots/desktop-staff-appointments.png)
- [desktop-staff-customers](review/screenshots/desktop-staff-customers.png)
- [desktop-staff-notifications](review/screenshots/desktop-staff-notifications.png)
- [desktop-staff-overview](review/screenshots/desktop-staff-overview.png)
- [desktop-staff-owner-section-restricted](review/screenshots/desktop-staff-owner-section-restricted.png)
- [desktop-staff-payments](review/screenshots/desktop-staff-payments.png)
- [desktop-staff-pending-confirmations](review/screenshots/desktop-staff-pending-confirmations.png)
- [desktop-staff-profile](review/screenshots/desktop-staff-profile.png)
- [desktop-staff-services](review/screenshots/desktop-staff-services.png)
- [mobile-admin-navigation-after-escape](review/screenshots/mobile-admin-navigation-after-escape.png)
- [mobile-api-outage-login-redirect](review/screenshots/mobile-api-outage-login-redirect.png)
- [mobile-customer-appointments](review/screenshots/mobile-customer-appointments.png)
- [mobile-customer-booking](review/screenshots/mobile-customer-booking.png)
- [mobile-customer-profile](review/screenshots/mobile-customer-profile.png)
- [mobile-navigation-after-escape](review/screenshots/mobile-navigation-after-escape.png)
- [mobile-owner-appointments](review/screenshots/mobile-owner-appointments.png)
- [mobile-owner-income-chart-scrolled](review/screenshots/mobile-owner-income-chart-scrolled.png)
- [mobile-owner-navigation-open](review/screenshots/mobile-owner-navigation-open.png)
- [mobile-owner-overview](review/screenshots/mobile-owner-overview.png)
- [mobile-owner-payments](review/screenshots/mobile-owner-payments.png)
- [mobile-owner-pending-confirmations](review/screenshots/mobile-owner-pending-confirmations.png)
- [mobile-owner-reports-chart-detail](review/screenshots/mobile-owner-reports-chart-detail.png)
- [mobile-owner-reports](review/screenshots/mobile-owner-reports.png)
- [mobile-owner-settings](review/screenshots/mobile-owner-settings.png)
- [mobile-public-booking-guest](review/screenshots/mobile-public-booking-guest.png)
- [mobile-public-contact](review/screenshots/mobile-public-contact.png)
- [mobile-public-home](review/screenshots/mobile-public-home.png)
- [mobile-public-login](review/screenshots/mobile-public-login.png)
- [mobile-public-navigation-open](review/screenshots/mobile-public-navigation-open.png)
- [mobile-public-register](review/screenshots/mobile-public-register.png)
- [mobile-public-services](review/screenshots/mobile-public-services.png)
- [mobile-staff-appointments](review/screenshots/mobile-staff-appointments.png)
- [mobile-staff-customers](review/screenshots/mobile-staff-customers.png)
- [mobile-staff-overview](review/screenshots/mobile-staff-overview.png)
