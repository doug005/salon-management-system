# Audit defect-resolution outcomes

## Public trust and verified business information
- Replace the public fictional/demo salon identity with the verified context supplied in the audit: **Makatleho Beauty Palour** and **Phomola Road, Lepoqong, Maseu 100, Lesotho**.
- Do not publish synthetic services, prices, promotions, fictional professionals, `.example` email addresses, placeholder phone numbers, or illustrative images as if they were real. When a value is not verified, hide it or label the capability as unavailable.
- Preserve positive public information architecture: homepage CTA, catalogue/detail structure, profile route shape, local time notice, English/Sesotho control, skip link, accessible mobile menu, and clear empty/loading/error states.

## Booking and status flow
- Let visitors choose a published professional/service/date/time and inspect availability before authentication; preserve the selection through login or registration and restore it after successful authentication.
- Make request, payment, pending-verification, confirmed, cancelled, expired, and notification expectations explicit without claiming payment processing or automatic WhatsApp/email delivery.
- Keep external manual payment and professional-only independent verification; do not invent payment recipients, methods, prices, or refunds.

## Account email and recovery
- Keep email verification and password recovery secure, single-use, expiring, and session-safe; surface actionable delivery status and do not claim email is available when SMTP is missing or failing.
- Validate production SMTP configuration fail-closed; test registration, verification, resend, login after verification, forgot-password, reset, and login after reset with the project’s approved transport test.

## Content, accessibility, and resilience
- Remove or clearly gate fictional/placeholder imagery; only real owner-supplied portfolio images may be presented as salon work, with a deliberate neutral fallback otherwise.
- Complete essential English/Sesotho labels and status/error/policy copy used by booking and account flows.
- Improve mobile touch targets, loading indicators, retryable error states, and online/offline messaging without queuing private actions offline.

## Verification and delivery
- Run affected backend/browser checks, lint, build, and security/dependency checks; update PROGRESS.md with actual results and blockers.
- Push the verified change to the existing GitHub repository `main` and deploy through the existing Vercel/Render services only; do not create replacement infrastructure. If provider-side credentials or verified SMTP/contact data are unavailable, record the exact blocker and do not fabricate it.
