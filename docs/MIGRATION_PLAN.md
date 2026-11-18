# Non-destructive migration plan — first milestone

## Inspection findings

The old app stores `owner/staff/customer` roles, global Services and singleton BusinessSettings, appointment staff references, globally unique method/reference payments, and unscoped expenses/audits. Owner queries and some staff payment queries can read all business records. Simply renaming roles would preserve these privacy flaws and incorrectly grant platform admin access to finances.

## Safe rollout implemented in milestone 1

- Introduce only admin/professional/customer as runtime roles. Reject historical owner/staff credentials/sessions with an explicit migration-required response; do not rewrite those documents at startup.
- Add required professional ownership to new business records and new ProfessionalProfile, ProfessionalCustomer and PlatformSettings collections. Retain BusinessSettings and legacy staff/verifier fields as historical data.
- Hide unassigned legacy rows from active APIs and workers. Do not make public all old global services or infer that the old owner owns every service/receipt.
- Add scoped indexes without dropping old indexes. Fresh isolated databases use the new professional slot/payment keys. A retained old global payment or staff-slot index can be stricter and block valid new writes until a reviewed index transition; never silently drop it.
- Development/test bootstrap uses a distinct database and data directory. The historical `salon_demo` database, original credential file and visual-review archive are not reset or overwritten.
- `npm run migration:assess -w server` is read-only and emits counts, legacy-role/unassigned-record findings and index warnings, not customer details, amounts or passwords. It has no apply/drop/delete mode.

## Before any existing-data backfill

1. Back up the authorised target database and verify restoration into a separate environment.
2. Inventory historical users/roles, records, relationships and indexes using the read-only assessor.
3. Supply explicit mappings of legacy accounts to admin/professional/customer. Do not map one identity to both admin and professional: those authorities are intentionally separate.
4. Review record-by-record or explicitly defined grouping ownership for every global service, setting, appointment, payment, expense and business audit. A historical recorder/verifier is evidence to review, not automatic proof of business ownership.
5. Require appointment/service/payment ownership consistency. Preserve historical verifier IDs, monetary values, status/timestamps, price/policy text and references. Do not replay verification, move money, recreate income, or emit customer email.
6. Reconcile existing professional/time collisions and duplicate professional payment references before creating required uniqueness constraints. Do not discard conflicting records to make an index pass.
7. Run a future validated/idempotent backfill on a restored copy; compare pre/post counts and financial totals offline; validate isolation and rollback.
8. Only after explicit review/approval, apply additive ownership changes and deliberate obsolete-index replacement. That executor and actual live mapping are outside this first milestone.

## Rollback and limitations

New collections/fields preserve original records. Rollback must not restore an old broad-access API against a live multi-professional database. Stop writes and restore the approved backup/application combination instead. Unknown ownership remains quarantined. Atlas credentials, actual mapping decisions and destructive index replacement are not supplied or executed here.

The current read-only assessor provides inventory counts and legacy-index warnings. It is not a complete orphan/reference consistency validator or approval to perform a backfill.
