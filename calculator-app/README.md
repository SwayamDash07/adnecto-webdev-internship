# Calculator App

A calculator built with **Next.js**, featuring 4 distinct visual themes: **Liquid Glass**, **Paper Receipt**, **Terminal**, and **Vintage**. Theme choice persists across sessions via `localStorage`.

Live URL- https://calculator-app-peach-one.vercel.app/

## Stack
- Next.js (client component, `useState`/`useEffect`)
- Plain CSS per theme

## Features
- Standard arithmetic operations with a running calculation tape
- Result formatting caps output at 12 digits, gracefully returns "Error" on overflow
- Theme switcher with 4 fully distinct visual styles, remembered between visits

## What I learned
- Managing calculator state (current value, previous value, pending operator, overwrite mode) cleanly in React without a state library
- Handling floating-point precision and digit-limit edge cases in the result formatter
- Building multiple cohesive visual themes for the same component structure, swapped via a single state value plus CSS

## Running locally
```bash
npm install
npm run dev
```
