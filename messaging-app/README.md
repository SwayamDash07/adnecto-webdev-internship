# Threadline

A messaging app built on the same architecture as ProfileHub: Next.js App Router, MongoDB via Mongoose, Server Actions for every mutation, no API routes.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in `MONGODB_URI` (make sure it includes a database name after the last `/`, e.g. `.../threadline`)
3. `npm run dev`

Remember: any schema change under `models/` or any `.env.local` edit needs a full restart (`Ctrl+C` then `npm run dev`), not just a save.

## Architecture

- `app/<route>/page.tsx` — Server Component pages
- `app/<route>/actions.ts` — `"use server"` Server Actions for that route
- `components/ui/` — InputField, SelectField, SubmitButton primitives
- `components/<feature>/` — grouped by feature
- `lib/` — db connection singleton, session cookie helpers, `requireUser()` guard
- `models/` — Mongoose schemas (User, Conversation, Message)

Auth follows the ProfileHub pattern exactly: signup/login generate a random token via `crypto.randomBytes`, store it on the user document as `sessionToken`, and set it as an httpOnly cookie. `middleware.ts` blocks protected routes with no cookie at all; `requireUser()` then confirms the cookie's token matches a real user in the DB.

Theme is a cookie (`threadline_theme`) read server-side in `app/layout.tsx` and applied via `data-theme` + CSS variables — no client JS.

Edit mode on the profile page and search filters both use URL query parameters (`?edit=true`, `?name=...`) instead of React state, consistent with the rest of the app.

## The one deliberate exception

Everything in this app is a Server Component or a Server Action — except `components/chat/LiveMessageList.tsx`, a small Client Component that polls `getNewMessagesAction` (a Server Action, not a `fetch` call or API route) every 3 seconds so new messages appear without a manual refresh. It's the only `"use client"` file in the project, scoped to exactly the one place where "zero client JS" and "usable chat" are in real tension.

If you'd rather keep the app 100% server-rendered, delete `LiveMessageList.tsx`, render the message list as a plain server-rendered `<div>` inside `app/chat/[conversationId]/page.tsx` (same JSX, minus the client wrapper), and drop `getNewMessagesAction` — messages will then only refresh when you send a message or reload the page.

## Search filters

Currently: name/username, organisation, location, skills (comma-separated, matched against the user's skill tags). The `User` schema also has a text index (`username`, `name`, `organisation`, `skills`) if you want to switch the regex-based search to `$text` search later for better relevance ranking at scale.

## Suggested next filters

- Batch / graduation year (you mentioned this as a maybe — the schema doesn't have it yet, easy to add as another field + search filter)
- Mutual connections / shared conversations
- "Active recently" based on a `lastSeenAt` timestamp updated in `requireUser()`
