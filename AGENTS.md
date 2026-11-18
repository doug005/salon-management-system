# Permanent project instructions

These instructions apply to this project root and all descendants. At the start of every session, read this file and PROGRESS.md before edits. This root AGENTS.md is the repository instruction entry point for Codex when the project is opened here. The architecture below supersedes historical owner/staff/single-salon instructions and older documentation.

## Responsibility and autonomy

Act as lead autonomous full-stack engineer. Inspect existing code first; preserve working architecture and data. Implement requested milestones completely, install permitted project-local dependencies, manage development servers, run relevant lint/build/unit/API/browser tests, diagnose failures and fix them without routine approval. Report actual results, never assumed success. Maintain PROGRESS.md with current milestone, changes, commands/results, limitations, blockers and exact resume instructions. Do not ask the user to execute safe routine commands you can execute.

## FINAL architecture

- Exactly three active roles: **admin**, **professional**, **customer**. Legacy `owner`/`staff` are historical data values only, never accepted as runtime privileges or silently mapped.
- Customers self-register. **Only admin creates professional accounts.** Professional self-registration, role changes through profile updates and privilege escalation are forbidden.
- Each professional independently owns/manages their public business profile, services, availability, appointments, booking fees/policies, externally arranged manual payments, expenses, financial reports, WhatsApp contact and seven-day advertisements.
- Professional-owned records must carry a server-controlled `professional` reference. Enforce ownership on every read/write, aggregate, nested reference, population, export and background operation. Never trust an ownership ID from a request body for private writes. A professional cannot access another professional's private records.
- Admin manages platform accounts, shared platform settings only. Admin **cannot record/verify professional payments, read private financial reports, or acquire professional-business privileges through a generic admin override**. Publicly published profiles/services/ads remain public; publication is not permission to read bookkeeping.
- Customers see only their own private appointments/payments/profile/notifications and explicitly published business information. Professional customer directories are relationship-scoped, not a shared list of every platform customer.
- Advertisements belong exclusively to professionals. Only the owning professional creates, edits, publishes, unpublishes or deletes them; admin has no moderation, approval or management authority. Publication is immediate, lasts exactly seven days, and permits at most three active advertisements per professional. Republishing requires unpublishing first and rechecks the limit. Public reads enforce expiry even before cleanup. Validate uploads, isolate ownership and retry image cleanup safely without deleting referenced assets.
- No payment gateway of any kind: no MoPay, Stripe, PayPal, or equivalent. External arrangements, manual recording and independent professional verification only. WhatsApp is manual click-to-chat, never an automated messaging integration. Never mark payment received automatically.
- Preserve MongoDB/Mongoose, Node/Express, React/React Router, Tailwind and esbuild. **No Vite.** Currency LSL stored in integer lisente and displayed as M; Africa/Maseru for local scheduling/display and UTC storage.
- Maintain secure JWT/bcrypt sessions and least privilege; concurrency-safe reservations, duplicate-payment prevention, transactional payment/appointment consistency, immutable historical price/policy snapshots and business/platform-separated audit trails.

## Data migration rules

Never delete or reset existing users, bookings, receipts, expenses, settings, reviews or financial history. No automatic owner-to-admin/professional conversion or blanket reassignment of global records. Preserve legacy IDs/fields/collections; unassigned legacy business records fail closed. Prepare dry-run inventory and explicit reviewed role/ownership mappings. Index changes are additive in this milestone; do not drop old indexes, run destructive syncIndexes, or overwrite a live database. Execute only authorised, validated migration steps, with backups and rollback planning. Use isolated synthetic databases for tests/demos; never silently migrate the existing demonstration database.

## Agreed dashboard design direction

Simple professional typography; clean white/light-gray surfaces; straightforward role-appropriate navigation; restrained purple accents; compact tables and forms; minimal gradients. Avoid generic flashy AI dashboard styling, decorative KPI clutter and unnecessary animation. Use the three previously generated role dashboard mockups as visual references **when supplied**. They are not present in this checkout; do not fabricate them. Establish role/ownership architecture before the visual redesign. Preserve accessibility, visible focus, semantic landmarks, responsive layouts and clear errors/loading/empty states.

## Safety

Work only inside this project; no unrelated personal files, sudo, system-wide settings or disabling sandbox protections. Never expose/commit secrets. No deployment, external-account changes, real email, real customer contact or financial-provider calls without explicit approval. Ask before genuinely destructive operations. SMTP defaults to safe mode. Use synthetic records only. Prefer cached local test/browser binaries; disable unexpected runtime downloads for offline work. Keep artifact archives free of credentials, tokens and personal data. Do not claim production readiness, real pilot consent, delivery or evaluation results without evidence.
