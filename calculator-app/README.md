# Calculator

A simple calculator built with Next.js (App Router). Supports digits 0–9, decimal point, addition, subtraction, multiplication, division, clear, and backspace. Works with mouse/touch clicks or your keyboard.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

## Project structure

```
app/
  layout.js        # root layout, loads fonts
  page.js           # calculator component + logic
  page.module.css   # calculator styles
  globals.css       # base reset + color tokens
package.json
next.config.mjs
```

## Keyboard shortcuts

- `0`–`9` — digits
- `.` — decimal point
- `+` `-` `*` `/` — operators
- `Enter` or `=` — equals
- `Backspace` — delete last digit
- `Esc` — clear
