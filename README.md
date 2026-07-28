# Adnecto Web Dev Internship

Web development projects completed during my internship at Adnecto Technologies, tracking my progression from static single-file components to a full-stack, server-driven application. This repo is actively growing — new projects get added as the internship continues.

## The journey

I started this internship already knowing the basics of HTML/CSS/JS, but with almost no real experience structuring a production-style app, managing state cleanly, or working with a database. Each project here represents a deliberate step up in complexity:

1. **[dark-gallery](./dark-gallery)** — my first real React/Next.js project. A dark-themed image gallery with a fullscreen lightbox. Simple, but this is where I learned component state, index-based navigation, and `useCallback`.
2. **[calculator-app](./calculator-app)** — took state management further: tracking a running calculation (current value, previous value, pending operator, overwrite mode) instead of just toggling UI. Also where I first built multiple complete visual themes (Liquid Glass, Paper Receipt, Terminal, Vintage) for the same component.
3. **[qna-game](./qna-game)** — a multi-screen jungle quiz game (name entry → quiz → results → history), built entirely with React state instead of a router. First project where I had to think about *data persistence* — the difference between `sessionStorage` and `localStorage`, and picking the right one for the right piece of data.
4. **[ProfileHub](./ProfileHub)** — by far the biggest jump. A full authentication system and personal profile dashboard, built with MongoDB/Mongoose for real data persistence, and a self-imposed constraint of using **Server Actions only** — no API routes, no client-side `fetch`, anywhere. This is where the earlier projects' local-state thinking had to evolve into real server-side data flow, sessions, and route protection.

*(More projects will be added here as they're completed.)*

Each project's own README includes its live demo link.

## What changed as I went

- **Local state → server state.** The first three projects live entirely in the browser (React state, `localStorage`). ProfileHub was the first time data had to survive across devices and sessions, which meant learning MongoDB, Mongoose schemas, and eventually the quirks of Mongoose's model caching in dev mode.
- **Guessing → debugging methodically.** Early on, I'd often just try things until they worked. By ProfileHub, I was using `console.log` statements deliberately to trace exactly where a request was failing — caught a duplicated function, a wrong database name in a connection string, and a stale cached schema this way.
- **One big file → organized structure.** dark-gallery and calculator-app are single-page components. ProfileHub is split into dozens of small, purpose-specific files (components, Server Actions, models, lib helpers) — a direct result of the codebase getting complex enough that one file stopped being manageable.
- **"Make it work" → "make it correct."** ProfileHub is the first project with real server-side validation (not just HTML `pattern` attributes), password hashing, session tokens, and two-layer route protection — security concerns that simply didn't exist in the earlier, client-only projects.

## Repo structure

```
adnecto-webdev-internship/
├── dark-gallery/       → Image gallery with lightbox (Next.js, client-side)
├── calculator-app/     → Multi-theme calculator (Next.js, client-side)
├── qna-game/           → Jungle-themed quiz game (Next.js, client-side + local storage)
├── ProfileHub/         → Full-stack auth + profile dashboard (Next.js, MongoDB, Server Actions)
└── ...                 → new projects added as the internship progresses
```

Each project has its own README with stack details, features, live demo link, and specific things I learned building it.
