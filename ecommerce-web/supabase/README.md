# Supabase SQL files

This directory groups the database files by purpose. The files are preserved as written; moving a file here does not apply it to Supabase or change the live database.

## Folder map

| Path | Contents | How to use |
| --- | --- | --- |
| `schema.sql` | Initial database types and tables | Bootstrap only for a new, empty project. Do not replay over an existing project. |
| `migrations/phases/` | The numbered phase history, including fixes and later workflow changes | Apply only migrations missing from the target database, respecting each file's prerequisite comments. |
| `migrations/segments/` | The eight security, catalog, customer, payments, inventory, fulfilment, reporting, and release segments | Ordered compatibility/hardening SQL. Check the phase dependencies before applying. |
| `setup/` | `live_reporting.sql` and `admin_auth.sql` | Legacy project setup scripts. Review their definitions and run only when setting up the corresponding functions/administrator role. |
| `seeds/` | Demo catalog data and catalog media/identity mapping | Demo data only. Do not run against a store whose catalog should be preserved. |
| `maintenance/` | Catalog availability view and historical notification/picker fixes | Targeted repairs; run only when needed and after their prerequisite schema exists. |
| `scenarios/` | Refund scenario SQL | Manual scenario/diagnostic SQL, not a deployment migration. |

## Migration notes

- `migrations/phases/phase39_refund_completion.sql` is an unapplied draft superseded by `phase40_returns_refunds.sql`; do not apply phase 39.
- `phase40_returns_refunds.sql` follows `phase22_returns.sql`. Phases 41–45 build on the returns workflow; their individual headers state prerequisites.
- `phase2_admin_orders_fix.sql` follows `phase2_admin_orders.sql`.
- `phase4_completion.sql` follows the other phase 4 scripts and `phase3_admin.sql`.
- `phase11_role_access.sql` depends on `segment6_fulfilment.sql` as well as phase 2 operations.
- `phase26_customer_support_role.sql` must be committed separately before phase 27 uses the new enum value.
- Phases 31–33 have explicit dependencies in their headers. Phase 34 must commit before phase 35.
- Phase 37 follows the checkout/payment migrations; phase 38 follows phase 37 and checkout changes.

The phase and segment histories grew in parallel and are not a timestamped Supabase CLI migration set. For an existing project, compare its applied database state and run only missing SQL in dependency order; do not paste the whole folder into the SQL editor. The root README links here instead of prescribing a blanket replay.

## Local workflow

Use the Supabase SQL editor for the hand-maintained scripts in this repository, or convert them into timestamped Supabase CLI migrations as a separate reviewed change. Keep credentials and customer data out of SQL files committed to GitHub. Demo seeds and maintenance scripts are intentionally separate from the normal schema/migration history.
