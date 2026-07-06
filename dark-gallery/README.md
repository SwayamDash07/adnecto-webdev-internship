# Dark Gallery

A dark-themed image gallery with a fullscreen lightbox viewer, built as an early React/Next.js learning project.

Live URL- https://gallery-project-ecru.vercel.app/

## Stack
- Next.js (client component)
- Plain CSS, dark theme

## Features
- Responsive image grid (16 images)
- Click any image to open a fullscreen lightbox
- Next/previous navigation within the lightbox, boundary-safe (won't go past the first/last image)
- Click outside the image to close

## What I learned
- Basic gallery/lightbox UX patterns: index-based navigation, boundary checks, click-outside-to-close
- First real use of `useCallback` to avoid re-creating handler functions on every render
- Structuring a simple, self-contained client component before moving on to more complex full-stack projects

## Running locally
```bash
npm install
npm run dev
```
