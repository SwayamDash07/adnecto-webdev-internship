# Cartly Hypermarket

A full-stack online marketplace built with **Next.js**, **Supabase**, and **Razorpay test mode** during my internship at Adnecto Technologies.

Live URL — https://cartly-mu-livid.vercel.app/  
Admin sign-in — https://cartly-mu-livid.vercel.app/auth/admin-sign-in

## What it is

Cartly is an online hypermarket with separate customer and admin experiences. Customers can browse products, manage their cart, check out, track orders, and request eligible returns, refunds, or exchanges. Admins can manage products, inventory, orders, delivery, and return requests through an operations portal.

## Stack

- **Next.js 15** — App Router, React Server Components, Server Actions, and API routes
- **TypeScript** — application and data types
- **Supabase** — authentication, PostgreSQL database, storage, and realtime updates
- **Razorpay** — test-mode checkout and refunds
- **CSS and Tailwind CSS** — responsive interfaces
- Hosted on Vercel

## Key decisions

**Supabase-backed authentication** — customer and admin accounts use Supabase Auth. Server-side checks and role-based permissions protect operations pages and actions.

**Database workflows** — SQL functions and migrations handle important operations such as order transitions, inventory updates, and returns. Keeping those rules close to the database helps maintain consistent state across the app.

**Separate customer and operations flows** — the storefront supports shopping and order tracking, while the admin portal brings product, inventory, fulfillment, delivery, and returns tools together.

**Test-mode payments** — Razorpay checkout and refund requests are connected through server-side routes. The integration uses test mode, so it does not move live money.

## Features

- Product catalog, search, product details, and cart
- Customer registration, sign-in, saved addresses, and order tracking
- Checkout with Razorpay test-mode payments
- Admin product and inventory management, including returnability settings
- Order picking, packing, and delivery workflows
- Return, refund, and exchange requests with pickup tracking
- Admin review and processing for refunds and exchanges

## What I learned

- Connecting server-rendered pages and client interactions to a shared database
- Designing role-based access for customer, admin, picker, and delivery workflows
- Keeping order, inventory, payment, and return states consistent
- Integrating a payment provider through server-side endpoints
- Organizing a larger app into focused pages, components, server actions, API routes, and SQL scripts
- Debugging issues across the browser, Next.js server, Supabase, and external services

## Running locally

```bash
npm install
```

Create a `.env.local` file with the Supabase and Razorpay environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
ADMIN_ROUTE_TOKEN=
NEXT_PUBLIC_ADMIN_ROUTE_TOKEN=
```

Keep server secrets private. Use Razorpay test credentials for local development.

```bash
npm run dev
```
