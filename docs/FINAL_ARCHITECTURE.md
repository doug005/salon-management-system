# Final multi-professional architecture

This is the controlling architecture decision. Historical single-salon owner/staff guides and visual review screenshots describe the pre-migration system. Root AGENTS.md preserves these decisions for future sessions.

## Roles and boundaries

| Capability | Admin | Professional | Customer |
| --- | --- | --- | --- |
| Create professional accounts / manage platform accounts | Yes | No | No |
| Customer self-registration | Public customer-only flow | Public customer-only flow | Yes |
| Shared platform name/settings | Manage | Public read | Public read |
| Professional business profile/contact/WhatsApp/hours/fee policy | Public read if published; no private override | Own only | Published read |
| Services | Published read | Own CRUD | Published read |
| Appointments | No private business access | Own only | Own bookings only |
| Manual payment recording/verification | **Never** | Own only | Own payment status/receipts only |
| Expenses/private reports/financial exports | **Never** | Own only | No |
| Business audit/notifications | No private business history | Own business only | Own notifications |
| Account/platform audit | Platform operations only | No | No |
| Advertisements | Public read only; no management or moderation | Own create/edit/publish/unpublish/delete | Current published public ads |

Admin is not a business superuser. Possessing an admin role or guessing an ObjectId does not bypass professional ownership. Published prices, contacts and booking policies are intentional public information, not private financial reports.

## Data ownership

Use `User._id` of a professional as the tenant key. Services, appointments, slot claims, payments and expenses carry a required `professional` reference. ProfessionalProfile is a one-per-professional business-settings collection. PlatformSettings is a separate singleton without booking fees or private financial fields. ProfessionalCustomer stores unique professional/customer relationships for scoped lookup. Audit and Notification distinguish professional business events from platform/personal events. Account management responses expose account fields only, never joined business finance.

Every query is scoped before lookup or population. Private mutations derive professional from the authenticated professional, not request bodies/query strings. Customer bookings derive professional from the selected owned service and validate consistency. Payment ownership must agree with the appointment. Cross-owner IDs return not-found/denied without exposing foreign details. Reports and exports use the same scope as lists. System expiry may process assigned bookings across professionals internally without giving any user access to other businesses. Legacy unassigned records are excluded.

## Booking and manual money

Keep transaction-protected quarter-hour claims unique per professional/time. Professionals set their own hours, closure dates, fee, deduction mode, hold duration, change window and policy. Appointments snapshot the selected professional's service and policy. Professionals can manage only their own bookings and manually verify only their own payments. Admin cannot perform either action. Verified payments alone confirm bookings, in a transaction with the relevant payment, appointment revision and business audit entry. References deduplicate within a professional; remaining old global indexes are retained until a reviewed index transition.

No gateway, card processing or money transfer is introduced. WhatsApp opens a professional-specific prefilled message and requires manual sending. Store money as integer lisente; show M. Store UTC timestamps; use Africa/Maseru for business dates.

## Seven-day advertisements

Professionals manage their own advertisements without admin approval. Publication immediately starts a server-controlled period of exactly 168 hours. At most three advertisements per professional can be active; a professional-scoped transaction lock serializes publication checks. Editing does not extend the window. Unpublishing hides immediately; republishing starts a new seven-day period and checks the limit again. Public queries use `startsAt <= now < endsAt` and exclude inactive accounts. No administrator advertisement management endpoints exist.

Images are decoded/re-encoded as WebP, capped at 5 MB input and 20 megapixels, and stored outside MongoDB. Durable image records support retryable orphan cleanup; public image access checks current publication. A 30-second worker marks expired advertisements and detaches images. Referenced images are retained; abandoned staged uploads have a one-hour grace period. See ADVERTISEMENTS.md for storage and API details. Legacy moderation fields remain physically preserved but confer no publication authority.

## Authentication and migration

Active role enum is admin/professional/customer. Public registration always creates a customer and rejects role/ownership fields. A controlled one-time admin bootstrap replaces the old owner bootstrap. Only an authenticated admin endpoint creates professionals. Profile edits cannot change roles, tenant IDs or account activation. Role/activation/token-version checks read the database on each request; old JWTs are not a route to owner/staff privileges.

Legacy owner/staff accounts and global business records remain physically untouched in their existing collections. They receive no runtime privilege until an explicit mapping is reviewed. Ambiguous global service/settings/payment ownership must not be guessed. Preserve old `staff`, `recordedBy`, verifier, timestamps, price/policy snapshots and original IDs. Use a separate multi-professional synthetic database for local validation; do not reset or silently backfill the existing demo. Add new indexes; retain obsolete indexes pending approved transition. See MIGRATION_PLAN.md.

## Frontend and design

Role entry points: `/admin` for account/platform functions, `/professional` for owned operations, `/account` for customers. Frontend guards and navigation reflect backend permissions; hiding a link is not authorisation. Existing functional React components and esbuild tooling are reused. Milestone 3 implements a shared sidebar/header/content shell for all three roles, with compact tables and forms, responsive navigation and scoped overview data.

Agreed visual direction: simple professional typography, white/light-gray surfaces, straightforward navigation, restrained purple accents, compact tables/forms, minimal gradients, no generic flashy AI dashboard styling. The three role mockups will guide the redesign when provided; no mockup files were supplied in this task.

## Milestones

1. Role/ownership foundation — verified.
2. Professional-only seven-day advertisement workflow, images and cleanup.
3. Dashboard redesign implements the written visual requirements; reference images remain unavailable for comparison.
4. Basic offline PWA support remains unimplemented and requires the next authorised milestone.

Legacy mappings/backfill remain separately reviewed work. No deployment, live email, external account changes or real-money actions are authorised.
