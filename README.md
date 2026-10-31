# Adnecto Web Dev Internship

Web development projects completed during my internship at Adnecto Technologies, tracking my progression from static single-file components to a full-stack, server-driven application. This repo is actively growing — new projects get added as the internship continues.

## The journey

I started this internship already knowing the basics of HTML/CSS/JS, but with almost no real experience structuring a production-style app, managing state cleanly, or working with a database. Each project here represents a deliberate step up in complexity:

1. **[dark-gallery](./dark-gallery)** — my first real React/Next.js project. A dark-themed image gallery with a fullscreen lightbox. Simple, but this is where I learned component state, index-based navigation, and `useCallback`.
2. **[calculator-app](./calculator-app)** — took state management further: tracking a running calculation (current value, previous value, pending operator, overwrite mode) instead of just toggling UI. Also where I first built multiple complete visual themes (Liquid Glass, Paper Receipt, Terminal, Vintage) for the same component.
3. **[qna-game](./qna-game)** — a multi-screen jungle quiz game (name entry → quiz → results → history), built entirely with React state instead of a router. First project where I had to think about *data persistence* — the difference between `sessionStorage` and `localStorage`, and picking the right one for the right piece of data.
4. **[ProfileHub](./ProfileHub)** — by far the biggest jump. A full authentication system and personal profile dashboard, built with MongoDB/Mongoose for real data persistence, and a self-imposed constraint of using **Server Actions only** — no API routes, no client-side `fetch`, anywhere. This is where the earlier projects' local-state thinking had to evolve into real server-side data flow, sessions, and route protection.
5. **[ecommerce-web](./ecommerce-web)** — **Cartly Hypermarket**, a full-stack online marketplace built with Next.js and Supabase. It includes customer accounts, product and inventory management, checkout and Razorpay test-mode payments, plus admin workflows for order picking and delivery. I also built return, refund, and exchange flows, including admin review and delivery pickup steps.

Each project's own README includes its live demo link.

## What changed as I went

- **Local state → server state.** The first three projects live entirely in the browser (React state, `localStorage`). ProfileHub was the first time data had to survive across devices and sessions, which meant learning MongoDB, Mongoose schemas, and the quirks of Mongoose's model caching in dev mode. Cartly extended that experience with Supabase-backed data and workflows across customers, inventory, and orders.
- **Guessing → debugging methodically.** Early on, I'd often just try things until they worked. By ProfileHub, I was using `console.log` statements deliberately to trace exactly where a request was failing — catching a duplicated function, a wrong database name in a connection string, and a stale cached schema. Cartly gave me more practice tracing issues across the UI, server actions, database functions, and external services.
- **One big file → organized structure.** dark-gallery and calculator-app are single-page components. ProfileHub is split into purpose-specific files (components, Server Actions, models, and library helpers). Cartly applies that same structure across customer-facing pages, admin tools, shared components, and database scripts.
- **"Make it work" → "make it correct."** ProfileHub introduced server-side validation, password hashing, session tokens, and route protection — security concerns that didn't exist in the earlier client-side projects. Cartly builds on that with role-based admin access, server-side payment handling, and controlled return and refund workflows.


## Repo structure

```
adnecto-webdev-internship/
├── dark-gallery/       → Image gallery with lightbox (Next.js, client-side)
├── calculator-app/     → Multi-theme calculator (Next.js, client-side)
├── qna-game/           → Jungle-themed quiz game (Next.js, client-side + local storage)
├── ProfileHub/         → Full-stack auth + profile dashboard (Next.js, MongoDB, Server Actions)
└── ecommerce-web/      → Cartly Hypermarket (Next.js, Supabase, Razorpay test mode)
```

Each project has its own README with stack details, features, live demo link, and specific things I learned building it.
