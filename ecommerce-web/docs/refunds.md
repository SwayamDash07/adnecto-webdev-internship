# Returns and refunds

This document describes Cartly's returns, refunds, and exchange flow implemented by the phase 40+ migrations and the customer/admin pages.

## Settings

The canonical database settings are stored in `public.returns_settings` and read through `public.get_returns_settings()`. The idempotent seed in `supabase/migrations/phases/phase40_returns_refunds.sql` sets:

| Setting | Value |
| --- | --- |
| Return window | 7 days from delivery |
| Refund ETA | 5–7 business days |
| Auto-approval ceiling | ₹5,000 |
| Auto-approval reasons | Changed my mind, Wrong item, Damaged or defective, Not as described |
| Maximum open requests per customer | 5 |
| Pickup reschedules | 1 |
| Request review SLA | 24 hours |
| Attachments | Disabled |

The UI wording and defaults are in `lib/returns-config.ts`; eligibility, limits, and transition enforcement are authoritative in SQL. Keep these values aligned when changing policy. Refunds are submitted server-side to Razorpay Test Mode using captured payment IDs; live Razorpay keys are rejected by this endpoint. Test Mode does not move live money. Exchanges do not issue refunds.

## Eligibility and amounts

`public.get_return_eligibility(order_id)` is the source of truth for per-line eligibility and blocked reasons. Delivered orders may be requested within the return window. Perishable or explicitly non-returnable products are only eligible for damage, wrong-item, or not-as-described claims. The order cancellation RPC handles pre-dispatch cancellation separately: prepaid orders receive the automatic cancellation refund; COD cancellations do not create a refund.

Refund calculations use order-time values saved with the order. SQL allocates discounts, GST, and eligible fees across lines in cents, with remainder allocation so the selected shares reconcile to the order total. Staff may reduce an amount after receipt with a required reason; the final amount cannot exceed the requested amount or amount paid.

## Status flow

```text
Return and refund: requested → approved → pickup_scheduled → picked_up → received → refunded
Refund only:       requested → approved → refunded
Rejection:         requested → rejected (staff note required)
Customer cancel:   requested → cancelled (before pickup is scheduled)
```

Each accepted step records an event with actor, role, timestamp, and note. Repeating the current step is idempotent. Refund issuance records `refunded_at`, the Razorpay refund ID, and expected arrival. Pickup scheduling creates a four-digit code and QR payload; the customer can reschedule once before collection. Receipt records partner acceptance and the stock disposition. Inventory changes use the existing adjustment path only when the stock choice requests it.

## Permissions

The phase 40 migration extends the existing role permission resolver and checks permissions inside RPCs as well as in the UI:

| Permission | Intended access |
| --- | --- |
| `refunds:view` | Super admin, store manager, customer support |
| `refunds:decide` | Super admin, store manager, customer support; approve/reject |
| `refunds:receive` | Super admin, store manager; receipt and refund processing |
| `refunds:pay` | Super admin, store manager; issue Razorpay Test Mode refund |
| `refunds:pickup` | Delivery role; mark a scheduled pickup collected |

Customers can read and create requests for their own orders. Pickers have no refund access.

## Operations and reporting

Use the Operations refund queue for review, pickup, receipt, and refund actions. The customer Orders views show eligibility, request status, pickup instructions, and refund reference. Reports and Overview use the shared net-revenue calculation: paid order revenue less refunded amounts, excluding cancelled orders. Refund report date boundaries use India Standard Time.

## Deployment

`supabase/migrations/phases/phase40_returns_refunds.sql` is a migration file. On an existing project, apply it only if its changes are not already present; do not replay the whole SQL directory. `supabase/scenarios/refund_scenarios.sql` is a separate manual scenario script, not a deployment migration.
