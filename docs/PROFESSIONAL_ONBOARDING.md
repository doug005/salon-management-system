# Secure professional onboarding

## Data-safety boundary

The four requested professional email addresses are staged only in ignored, mode-restricted `.local/professional-invite-recipients.csv`. No real account has been created or emailed by this patch. The assignment asked for onboarding, but the only configured backend/database target and approved SMTP mode must be established before applying changes to existing Atlas accounts. Never migrate, reset, or use the isolated synthetic demo database for these real people.

## Admin invitation workflow

1. An existing platform **admin** invites one professional email through the Accounts workspace. The API normalizes the email, rejects duplicates, assigns only `professional`, creates a separate unpublished professional profile, leaves `emailVerified=false`, and marks `setupPending=true`.
2. The random setup token is 32 cryptographically secure bytes, stored only as a SHA-256 hash in `AuthChallenge`, expires in 24 hours, and is single-use. The API/UI never returns or displays it. An admin may resend, which consumes earlier unexpired invitations before sending the new one.
3. The professional follows the one-time link in their own mailbox and sets their own name and password. Successful redemption atomically confirms control of that email address, sets a bcrypt password, clears setup-pending status, marks the address verified **because the recipient redeemed the private inbox link**, audits the operation, and starts a normal least-privilege professional session.
4. Initial admin invitations intentionally contain no customer/service ownership and grant no administrative privilege. The professional sets their real business name, WhatsApp number, contact details, service/prices and availability under their own session. The profile remains unpublished and online booking is blocked until the valid WhatsApp number is entered.

## SMTP safe-mode requirements

Real invitations require an admin-approved SMTP provider, backend-only `EMAIL_MODE=smtp`, `EMAIL_DELIVERY_APPROVED=yes`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Google/SMTP credentials must never be copied into source, slides, shell arguments, browser automation, terminal output, or Git. SMTP defaults to safe mode; if delivery is not configured, the invitation is not usable and **must not be handed to the recipient through chat, phone, shared tokens, or manual password**. Configure SMTP first, then use the admin Resend action or the server invitation helper.

## Four exact addresses

Use the ignored recipient manifest and review each account individually before sending. The helper is an operator shortcut and is intentionally not invoked automatically. It refuses to overwrite an existing non-pending account. Existing pending invitations can be safely resent. If an address already belongs to a verified/customer/active professional account, stop: do not convert, reassign, or create a duplicate. The current task cannot claim that any of these four people owns the corresponding address until they redeem the emailed link.

## Limitations

The invitation route and setup-token lifecycle have synthetic integration tests. No real email delivery, inbox ownership, person identity, business profile, WhatsApp contact, or live Atlas invitation is evidenced here. Professionals cannot accept customer bookings until they complete and publish their actual business profiles.
