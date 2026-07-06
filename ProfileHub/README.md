# ProfileHub

A personal profile dashboard built with **Next.js (App Router)**, **MongoDB/Mongoose**, and **Server Actions only** — no API routes, no client-side `fetch`. Built during my internship at Adnecto Technologies.

## What it is

Signup/login system plus a LinkedIn/GitHub-style profile dashboard where users edit their own bio, skills, experience, education, and projects. Started as an admin dashboard, pivoted to a personal-profile format per supervisor feedback.

## Stack

- **Next.js 16** — App Router, Server Components + Server Actions
- **MongoDB/Mongoose** — data storage
- **bcryptjs** — password hashing
- Plain CSS with custom properties for light/dark theming
- Hosted on Vercel

## Key decisions

**Server Actions only** — every form (login, signup, profile edits, password change) submits via `<form action={serverFunction}>`. No `/api/*` routes anywhere. UI toggles (edit mode, nav menu) run through URL params or CSS `:checked` selectors instead of React state. Only exception: CSS hover/load animations, which are inherently browser-side.

**Sessions** — a random token (`crypto.randomBytes`) is stored on the user's MongoDB document and sent to the browser as an `httpOnly` cookie. Each request checks whether a user in the database matches that token.

**Route protection, two layers** — middleware blocks `/dashboard/*` with no session cookie; `requireUser()` then confirms the cookie's token matches a real user in the DB.

## Features

- Signup with server-side validation (10-digit phone, `@gmail.com` only, DOB can't be future, unique username/email)
- Profile dashboard: bio, skills, experience — plus optional Education/Projects sections (LinkedIn-style, hidden until populated)
- Settings: edit personal info, change password (requires current password verified via `bcrypt.compare`)
- Light/dark theme via cookie + CSS variables, no JS

## What I learned

- Server Actions vs. API routes, and the tradeoffs of going fully server-first
- Mongoose schema defaults only apply on document creation, and a running dev server caches the compiled model (had to restart it more than once after schema changes)
- Debugging via `console.log` + reading server output — caught a duplicated function, a wrong DB name, and a stale model this way
- CSS-only interactivity (checkbox/label nav menu) and browser quirks with animating native `<details>`
- Responsive layout fixes — why a fixed grid breaks on mobile, rebuilt as a stacked layout

## Running locally

```bash
npm install
```

`.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/authApp
```

```bash
npm run dev
```
