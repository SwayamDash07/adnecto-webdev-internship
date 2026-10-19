# Client module classification (Phase 1)

Captured from the current checkout on 2026-10-20 before changing app modules. `rg -l 'use client' app components hooks lib` returns 84 modules. Classification describes what each module should be after the server-first migration; group C is a target split, not a claim that the split already exists. Current checkout already has substantial unrelated uncommitted work, so the audit is based on the current files and routes.

## Classification table

| Group | Modules | Why |
|---|---|---|
| **A — keep client** (interactive island, context/provider, hook, or browser service) | `components/providers.tsx`; `components/shared/cart-add-control.tsx`, `cart-drawer.tsx`, `cart-toast.tsx`, `back-button.tsx`, `product-modal.tsx`, `product-card.tsx`, `support-chat-thread.tsx`; `components/customer/account/address-manager.tsx`, `gift-voucher.tsx`; `components/customer/header/header-actions.tsx`, `account-menu.tsx`, `header-search.tsx`; `components/customer/products/wishlist-heart.tsx`, `product-detail-photos.tsx`; `components/customer/refund-request-dialog.tsx`; `components/admin/banners/banner-editor.tsx`, `banner-library.tsx`; `components/admin/complaints/ComplaintComposer.tsx`; `components/admin/orders/order-queue-toolbar.tsx`; `components/admin/admin-shell.tsx`, `admin-identity.tsx`; `components/admin/delivery-slot-manager.tsx`; `components/admin/fulfilment-queue.tsx`; `components/admin/inventory/inventory-manager.tsx`; `components/admin/support/support-manager.tsx`; `components/admin/stats.tsx`; `components/admin/report-workspace.tsx`; `components/admin/coupons/coupon-manager.tsx`; `components/customer/checkout-flow.tsx`, `live-checkout-flow.tsx`, `product-detail-live.tsx`; `components/admin/products/product-manager.tsx`, `product-form-fields.tsx`; `lib/auth-state.tsx`, `cart-store.tsx`, `wishlist-store.tsx`, `catalog-client.ts`, `use-realtime-reload.ts`, `use-can.tsx`; `hooks/use-ist-now.ts`, `use-site-header.ts`; `app/error.tsx` | These use event handlers, state/effects, browser APIs, realtime subscriptions, optimistic controls, file interaction, or app-wide client context. Several are small island candidates once data is passed in (see C). |
| **B — server-renderable** (remove the client directive) | `components/customer/account/account-welcome.tsx`, `account-quick-links.tsx`; `components/customer/header/category-nav.tsx`; `components/customer/checkout-section.tsx`; `components/customer/customer-account.tsx`; `components/customer/products/catalog-product.tsx`; `components/admin/overview.tsx`; `components/admin/overview/NeedsAttentionPanel.tsx` | These currently serve as static/prop-rendering shells or sections without a need for browser state. `NeedsAttentionPanel` is a chart/status presentation and should be rechecked for any hidden interactive affordance before removing its directive. |
| **C — split server data owner + client island** | `app/auth/sign-in/page.tsx`, `app/auth/admin-sign-in/page.tsx`, `app/customer/cart/page.tsx`, `app/admin/products/new/page.tsx`; `app/customer/search/results.tsx`; `components/customer/customer-orders.tsx`, `customer-order-tracking.tsx`, `customer-notifications.tsx`, `customer-support.tsx`, `support-chat-screen.tsx`, `customer-wishlist.tsx`; `components/customer/site-header.tsx`; `components/customer/products/product-detail.tsx`, `product-detail-connected.tsx`, `catalogue-browser.tsx`; `components/admin/admin-order-queue.tsx`, `admin-accounts.tsx`, `admin-staff-messages.tsx`, `admin-notifications-bell.tsx`, `orders/order-queue-table.tsx`, `products/live-product-manager.tsx`, `purchases/live-purchase-manager.tsx`, `purchases/live-purchase-manager-v2.tsx`, `customers/live-customer-manager.tsx`, `support/live-support-manager.tsx`, `complaints/complaints-workspace.tsx`; `components/admin/banner-manager.tsx`; `hooks/use-admin-order-queue.ts`, `use-admin-overview.ts`, `use-banner-manager.ts`, `use-customer-account.ts`, `use-live-checkout.ts` | Initial reads currently happen in browser code or stateful page shells. Move the initial read to the page/server component, pass the result as props, and retain only the controls, forms, drawers and realtime behavior client-side. |

The group is assigned to each module by its main responsibility. A module that is itself a client data-fetch hook may be replaced outright when the read moves to a page; a UI component that currently fetches data belongs in C and will retain its interactive portion. Shared modules used in both a server wrapper and client island must be split or moved, never imported from server-only code into a client bundle.

## Client-side initial data fetches to remove

This is the priority list: the first view currently waits for a browser request and shows a loading state. “Small” means one bounded RPC/query; “medium” is several bounded reads or a nested row set; “large” means a potentially broad list or multiple full manager datasets. Exact row counts depend on account data and RLS.

| Client fetch module | Page(s) using it | Initial query scope |
|---|---|---|
| `hooks/use-admin-overview.ts` → `components/admin/overview.tsx` / overview panels | `/admin/overview` (portal overview) | Medium: orders RPC, up to 8 low-stock rows, late-orders RPC, started together. |
| `hooks/use-admin-order-queue.ts` → admin queue | `/admin/orders`, role-based order queue | Large: order queue RPC plus supporting lookups/filters; paginated/filterable list. |
| `components/admin/orders/order-queue-table.tsx` | `/admin/orders` | Large initial queue/table; order detail and live updates are later interaction reads. |
| `components/admin/admin-order-queue.tsx` | admin order queue entry | Large list/queue state and live changes. |
| `components/admin/products/live-product-manager.tsx` | `/admin/products` | Large: admin product RPC returns catalog rows; client filtering/pagination runs after fetch. |
| `components/admin/purchases/live-purchase-manager-v2.tsx` | `/inventory/purchases` and admin purchasing | Large: purchase-order RPC + product catalog RPC + current profile, in parallel. |
| `components/admin/purchases/live-purchase-manager.tsx` | purchasing route/legacy manager | Medium-large purchase order and lookup data. |
| `components/admin/inventory/inventory-manager.tsx` | `/inventory` | Large inventory list with client search/adjustment interactions. |
| `components/admin/customers/live-customer-manager.tsx` | `/admin/customers` | Large customer list/summary dataset. |
| `components/admin/coupons/live-coupon-manager.tsx` | `/admin/coupons` | Small: one coupon-list RPC. |
| `components/admin/delivery-slot-manager.tsx` | `/admin/delivery` | Small: one delivery-slot RPC. |
| `hooks/use-banner-manager.ts` → banner manager | banner admin route if mounted | Small: one banner-list RPC. |
| `components/customer/customer-orders.tsx` | `/customer/orders` | Medium-large: user-scoped order list with nested payment/refund/items/product images. |
| `components/customer/customer-order-tracking.tsx` | `/customer/orders/tracking` | Small-medium: one user-scoped order with nested line items; then realtime subscription. |
| `components/customer/customer-notifications.tsx` | customer notifications surface | Small: one notifications RPC; mark-read refresh is interactive. |
| `components/customer/customer-support.tsx` | `/customer/support` | Medium-large: latest 10 nested orders + support ticket RPC concurrently; signed image URLs are fetched when opening a ticket. |
| `components/customer/support-chat-screen.tsx` | `/customer/support/chat/[id]`, `/new` | Medium: ticket list/details, messages, and optional order lookup; realtime/focus refresh currently repeats reads. |
| `hooks/use-customer-account.ts` | `/customer/account` | Medium: user profile + addresses + wallet balance + reward balance in parallel. |
| `hooks/use-live-checkout.ts` | `/customer/checkout` | Medium: addresses plus delivery-slot API; coupon/order writes remain interactive. Product identity lookups during submit are not initial reads. |
| `lib/cart-store.tsx` | header/cart/checkout surfaces | Variable: guest localStorage and cart bootstrapping; authenticated cart must be rendered with the server cart and merged without losing guest items. |
| `lib/auth-state.tsx` / `hooks/use-site-header.ts` | shared layout/header | Small-medium: browser auth/profile/cart badge bootstrap that can cause header flash; replace initial state with server props while preserving auth-change updates. |

Realtime-only client modules such as `components/admin/admin-notifications-bell.tsx`, support inboxes, and tracking should receive the initial snapshot from the server and subscribe without refetching on mount. Queries used only after a user action (save, cancel, search, expand, message) do not block first paint and can remain in the island or move to server actions.

## Baseline notes

- The current count is 84, matching the supplied audit count.
- The current build marks `/customer/cart`, checkout, orders, tracking and sign-in routes as static despite their per-user behavior; this must be corrected to dynamic rendering as those routes are migrated.
- `middleware.ts` currently performs role/profile reads and route rewriting in addition to session refresh. It needs a separate route-guard treatment while preserving permission checks; it cannot simply be reduced to cookie refresh before equivalent guards are moved into server layouts/pages.

## Exhaustive module index

This index assigns one group to each of the 84 client-marked modules; the lists above explain the group intent and data-fetch details.

| Module | Group | Reason |
|---|---:|---|
| `app/admin/products/new/page.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `app/auth/admin-sign-in/page.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `app/auth/sign-in/page.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `app/customer/cart/page.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `app/customer/search/results.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `app/error.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/admin-accounts.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/admin-identity.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/admin-notifications-bell.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/admin-order-queue.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/admin-shell.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/admin-staff-messages.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/banner-manager.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/banners/banner-editor.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/banners/banner-library.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/complaints/ComplaintComposer.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/complaints/complaints-workspace.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/coupons/coupon-manager.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/coupons/live-coupon-manager.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/customers/live-customer-manager.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/delivery-slot-manager.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/fulfilment-queue.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/inventory/inventory-manager.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/orders/order-queue-table.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/orders/order-queue-toolbar.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/overview.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/admin/overview/NeedsAttentionPanel.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/admin/products/live-product-manager.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/products/product-form-fields.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/products/product-manager.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/purchases/live-purchase-manager-v2.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/purchases/live-purchase-manager.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/report-workspace.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/stats.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/admin/support/live-support-manager.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/admin/support/support-manager.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/account/account-quick-links.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/customer/account/account-welcome.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/customer/account/address-manager.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/account/gift-voucher.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/checkout-flow.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/checkout-section.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/customer/customer-account.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/customer/customer-notifications.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/customer-order-tracking.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/customer-orders.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/customer-support.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/customer-wishlist.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/header/account-menu.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/header/category-nav.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/customer/header/header-actions.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/header/header-search.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/live-checkout-flow.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/product-detail-live.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/products/catalog-product.tsx` | B | Static/prop-rendering component; no client state required. |
| `components/customer/products/catalogue-browser.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/products/product-detail-connected.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/products/product-detail-photos.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/products/product-detail.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/products/wishlist-heart.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/refund-request-dialog.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/customer/site-header.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/customer/support-chat-screen.tsx` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `components/providers.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/shared/back-button.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/shared/cart-add-control.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/shared/cart-drawer.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/shared/cart-toast.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/shared/product-card.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/shared/product-modal.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `components/shared/support-chat-thread.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `hooks/use-admin-order-queue.ts` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `hooks/use-admin-overview.ts` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `hooks/use-banner-manager.ts` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `hooks/use-customer-account.ts` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `hooks/use-ist-now.ts` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `hooks/use-live-checkout.ts` | C | Initial data/auth page should be server-owned; keep only its interactive controls as a client island. |
| `hooks/use-site-header.ts` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `lib/auth-state.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `lib/cart-store.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `lib/catalog-client.ts` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `lib/use-can.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `lib/use-realtime-reload.ts` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
| `lib/wishlist-store.tsx` | A | Interactive state, browser API, event handler, provider, hook, or live-only client service. |
