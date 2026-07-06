# Jungle Quiz Game

A quiz game with a jungle/monkey theme — enter your name, answer a randomized set of questions, see your results, and track past attempts via a history screen.

Live URL- https://qna-game-eight.vercel.app/

## Stack
- Next.js (client component)
- `sessionStorage` for the current player's name
- `localStorage` for persisting quiz history across visits

## Features
- **Name screen** → **Start screen** → **Quiz screen** → **Result screen** → **History screen**, each as a separate component
- Randomized question selection from a larger question bank each playthrough
- Tracks correct, skipped, and wrong answers per attempt
- Full history log (name, score, skipped, wrong, date/time) saved locally and viewable anytime

## What I learned
- Managing a multi-screen app flow with plain React state instead of a router
- Difference between `sessionStorage` (cleared per tab session) and `localStorage` (persists indefinitely) and picking the right one per piece of data
- Structuring question data and a random-selection helper separately from UI components for cleaner organization

## Running locally
```bash
npm install
npm run dev
```
