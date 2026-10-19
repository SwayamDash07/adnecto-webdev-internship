# Cartly migration baseline

Captured 2026-10-20 from the current checkout before this migration changed any files. The checkout was already dirty at capture time (74 tracked files modified and numerous untracked files), so this is a baseline for that working tree, not a clean `HEAD` build. Next.js production build completed successfully with Next.js 15.5.23. The route table below is the build output; `First Load JS` includes the shared 102 kB.

## First Load JS by route

| Route | Render | Page JS | First Load JS |
|---|---:|---:|---:|
| `/` | Dynamic | 212 B | 199 kB |
| `/customer/category/[slug]` | Dynamic | 200 B | 199 kB |
| `/customer/product/[id]` | Dynamic | 3 kB | 193 kB |
| `/customer/cart` | Static | 3.94 kB | 194 kB |
| `/customer/checkout` | Static | 8.19 kB | 198 kB |
| `/customer/orders` | Static | 4.42 kB | 199 kB |
| `/customer/orders/tracking` | Static | 5.77 kB | 200 kB |
| `/auth/admin-sign-in` | Static | 2.49 kB | 175 kB |
| `/admin/orders` | Dynamic | 8.93 kB | 200 kB |
| `/admin/products` | Dynamic | 5.35 kB | 199 kB |
| `/admin/reports` | Dynamic | 115 kB | 306 kB |

Shared chunks: 102 kB (`46.1 kB`, `54.2 kB`, and `2.08 kB`). Middleware: 93.6 kB.

## Local production response timings

Measured with `next start` on port 3100 and four sequential anonymous HTTP GETs per route. Values are elapsed milliseconds; first value is the cold request and the remaining three are warm requests. These are server response timings, not browser navigation/LCP timings, and have no authenticated session.

| Route | HTTP | Request times (ms) |
|---|---:|---:|
| `/` | 200 | 1921, 467.2, 514.6, 303.6 |
| `/customer/category/test` | 200 | 543.6, 465.1, 461.3, 993.4 |
| `/customer/product/test` | 200 | 261, 272.9, 325.3, 635.4 |
| `/customer/cart` | 200 | 22, 18.5, 9.6, 10.6 |
| `/customer/checkout` | 200 | 16.8, 10, 8.9, 8.7 |
| `/customer/orders` | 200 | 16.3, 8.5, 8.5, 8.4 |
| `/customer/orders/tracking` | 200 | 17.6, 9.9, 7.7, 7.9 |
| `/auth/admin-sign-in` | 200 | 16.4, 8.6, 8.1, 8.6 |
| `/admin/orders` | 404 | 123.7, 11.8, 12.8, 12.3 |
| `/admin/products` | 404 | 11.9, 11.2, 11.3, 10.9 |
| `/admin/reports` | 404 | 12.2, 13.1, 11.5, 10.6 |

The admin pages returned 404 because this app exposes them behind the protected `/portal/<ADMIN_ROUTE_TOKEN>/...` rewrite; unauthenticated timings for the internal `/admin/...` paths are not representative. Authenticated timings for cart, checkout, orders and tracking also remain unmeasured. No browser-based JavaScript-disabled check or two-account check was run for the baseline.

## Build validation

`npm run build`, `npm run typecheck`, and `npm test` passed (4 test files, 17 tests). The first `npm run lint` prompted to create missing ESLint configuration and exited with status 1. I added a non-interactive ESLint 9 flat config and script; `npm run lint` now passes with 75 warnings and no errors. Existing warnings are shown rather than hidden. Next's integrated build lint also passes with those warnings.
