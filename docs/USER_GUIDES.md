> Historical single-salon documentation. The current controlling role/ownership architecture is [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md), with current endpoints in [MIGRATION_API.md](MIGRATION_API.md). Owner/staff permissions and shared financial access described below no longer apply. Existing deployment preparation remains unverified; consult PROGRESS.md before use.

# Owner, staff and customer guides

All times shown by the application are Africa/Maseru. All displayed amounts use M. Administration forms explicitly labelled **lisente** take integers: 5000 means M 50.00. Demonstration prices are not real salon offers.

## First owner

Local demo: log in with the generated synthetic owner account from ignored `.local/demo-accounts.json`. Do not publish that file or use a synthetic account in production.

Real installation: configure Atlas, JWT secret, CLIENT_ORIGIN and a random one-time OWNER_SETUP_TOKEN in the private server environment. Submit registration fields plus that setup token to `/api/auth/provision-owner` from the configured same origin. The database transaction creates the owner and singleton provisioning marker. Repeating provisioning is rejected, including concurrent attempts. Remove the environment token after success and restart the API. There is no public owner registration form. API details are in API.md; a private CLI is available as `npm run provision-owner -w server`, reading a JSON object from standard input without printing secrets. This administrative bootstrap requires the actual owner's chosen account details; none have been invented.

## Owner workflow

1. Log in, open Dashboard and Profile, and change any temporary password. Password changes sign out all sessions.
2. Open Business Settings. Replace demo identity and description, add real contact/address/WhatsApp digits only with authorisation, set opening hours and closure dates, configure booking fee, whether it is deducted, hold duration, change window and owner-approved policy. Turn off the demo label only when content is real and verified. A positive booking fee is required.
3. Create Services with prices, descriptions and durations in 15-minute units. HTTPS images are optional; use authorised hosted image URLs. Deactivate old services instead of deleting history. Existing appointment prices do not change.
4. Create Staff with a strong temporary password, working days/hours and explicit verifier permission where appropriate. Staff should change their password immediately. Deactivate a departed employee to reject their sessions; handle their existing visits explicitly.
5. Customers can register themselves. The Customers section can also create synthetic or consented customer accounts; never create real customer accounts without permission. Securely communicate temporary credentials outside the app only with authorisation; there is no automatic invitation email with passwords.
6. Book a visit or create one on behalf of a selected customer. Check accepted policy, service, staff, local time and total. Availability can change until submission; a conflict message means choose another time.
7. Record externally arranged payments in Payments. Select booking, purpose, method, integer amount and unique external/cash receipt reference. Optional receipt evidence is only an HTTPS link, not proof of funds. Recording does **not** confirm.
8. Open Pending Confirmations. Independently check cash or the actual external account. Enter review notes and choose verified funds, reject, or request information. Never verify solely from a screenshot. A verified fee atomically confirms the appointment; duplicate confirmation is rejected.
9. Record and verify remaining balance separately. Do not record the fee twice. Deducted-fee example: M250 service with M50 fee means M200 remaining; separate-fee example means M300 total and M250 remaining. The application prevents overpayment and duplicate fee receipts.
10. Use Appointments to cancel, reschedule, complete or mark no-show. Completion/no-show is only available for confirmed appointments whose end has passed. Cancelled/completed/no-show bookings are closed. Received income remains on cancellation; any refund/reconciliation is external and must not be represented as fabricated payment success.
11. Record expenses under the correct category. Reports show verified fee/balance receipts, recorded expenses by category, basic profit/loss, booked value, outstanding balances and service popularity. Choose daily/last-seven-day/month presets or date filters and export the CSV summary. These are cash summaries, not a statutory accounting package.
12. Review Notifications and Audit history. Safe-mode logs are marked simulated. Retry failed deliveries only after configuration is corrected and real delivery is approved.

## Staff workflow

- Log in to the same Login page; a staff role opens its permitted dashboard.
- See assigned appointments, create bookings for customers, search/register customers and inspect the service catalogue.
- Working hours are managed by the owner. Choose available staff/time when creating visits; manage cancellation/rescheduling only for assigned visits.
- Record external payment details. Verification buttons only work if the owner explicitly grants verifier permission. Keep independent verification evidence and notes; a customer screenshot alone is insufficient.
- Expenses, reports, staff management, business settings and audit history are owner-only. Direct URL/API attempts are rejected by backend permissions.

## Customer workflow

1. Register with your own name/email and a password of at least 12 characters (maximum 72 UTF-8 bytes). Log in to view Your salon account.
2. Browse professionals and services, then choose a professional, service, date and available local time. Read the fee and policy.
3. Select **Request Book** and review the professional, service, date/time, price and booking fee in the confirmation dialog. **Cancel** creates no booking. **Confirm** creates one saved pending request and shows its unique `SAL-` reference.
4. The site opens a prefilled WhatsApp chat to that selected professional only after the booking is saved. WhatsApp does not send the message; review it and press Send yourself if you want to contact the professional. If it does not open, use **Continue on WhatsApp** on the saved request. Reopening the link does not create another booking.
5. Arrange the booking fee with the professional outside the website. The professional records the actual receipt method/amount/reference and independently verifies received funds. A WhatsApp conversation, claim or screenshot does not mark payment paid.
6. Watch appointment/payment statuses in your account. The appointment is Confirmed only after professional verification; the existing notification/email worker queues the confirmation with delivery status. If the hold expires first, the slot is released; contact the salon to reconcile any late external payment rather than assuming a reservation exists.
7. Reschedule/cancel within the configured self-service window. Contact the salon if the window has closed. Closed bookings cannot be reopened. Policy snapshots remain available on the record.
8. Edit your profile or change password from Profile. Log out after using a shared device. Refresh normally retains your session through a secure rotating cookie; after expiry sign in again.

## Data and privacy

Customers see only their own appointments/payments/notifications. Staff have role-limited operational access. Do not put private payment details in public business settings, image URLs or booking notes. Live data retention, consent notices, refunds and legal policy text require an owner-approved process before production/pilot use.
