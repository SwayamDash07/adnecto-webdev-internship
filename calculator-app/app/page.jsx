"use client";

import { useState, useEffect } from "react";

const MAX_DIGITS = 12;

const THEMES = [
  { key: "glass", label: "Liquid Glass" },
  { key: "paper", label: "Paper Receipt" },
  { key: "hacker", label: "Terminal" },
  { key: "vintage", label: "Vintage" },
];

function opSymbol(op) {
  if (op === "x") return "×";
  return op;
}

export default function Calculator() {
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [overwrite, setOverwrite] = useState(true);
  const [theme, setTheme] = useState("glass");
  const [tape, setTape] = useState([]); 

  useEffect(() => {
    const saved = window.localStorage.getItem("calc-theme");
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("calc-theme", theme);
  }, [theme]);

  function digitCount(str) {
    return str.replace("-", "").replace(".", "").length;
  }

  function formatResult(result) {
    if (result === "Error") return "Error";

    const integerDigits = digitCount(String(Math.trunc(result)));
    if (integerDigits > MAX_DIGITS) return "Error";

    const decimalDigits = MAX_DIGITS - integerDigits;
    const rounded = Number(result.toFixed(decimalDigits));
    return String(rounded);
  }

  function inputDigit(value) {
    if (display === "Error") return;

    if (overwrite) {
      setDisplay(value === "." ? "0." : value);
      setOverwrite(false);
      return;
    }
    if (value === "." && display.includes(".")) return;
    if (display === "0" && value !== ".") {
      setDisplay(value);
      return;
    }

    const next = display + value;
    if (digitCount(next) > MAX_DIGITS) {
      return;
    }
    setDisplay(next);
  }

  function handleBackspace() {
    if (display === "Error") {
      handleClear();
      return;
    }
    if (overwrite) return;

    if (display.length === 1 || (display.length === 2 && display.startsWith("-"))) {
      setDisplay("0");
      setOverwrite(true);
      return;
    }
    setDisplay(display.slice(0, -1));
  }

  function calculate(a, b, op) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "x") return a * b;
    if (op === "÷") return b === 0 ? "Error" : a / b;
  }

  function chooseOperator(op) {
    if (display === "Error") return;
    const current = parseFloat(display);

    if (operator && !overwrite) {
      const result = calculate(prevValue, current, operator);
      const formatted = formatResult(result);
      setDisplay(formatted);
      setPrevValue(formatted === "Error" ? null : result);
    } else {
      setPrevValue(current);
    }
    setOperator(op);
    setOverwrite(true);
  }

  function handleEquals() {
    if (display === "Error" || operator === null) return;
    const current = parseFloat(display);
    const result = calculate(prevValue, current, operator);
    const formatted = formatResult(result);

    setTape((prev) => {
      const entry = {
        expr: `${prevValue} ${opSymbol(operator)} ${current}`,
        result: formatted,
      };
      const next = [...prev, entry];
      return next.slice(-4); // keep last 4 lines of "tape"
    });

    setDisplay(formatted);
    setPrevValue(null);
    setOperator(null);
    setOverwrite(true);
  }

  function handleClear() {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setOverwrite(true);
  }

  const isPaper = theme === "paper";

  return (
    <main data-theme={theme} className="page">
      {theme === "glass" && <div className="glass-bg-blob" aria-hidden="true" />}
      <div className="calculator">
        <div className="top-row">
          <span className="wordmark">calc.</span>
          <div className="theme-row">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={`theme-swatch swatch-${t.key} ${theme === t.key ? "active" : ""}`}
                onClick={() => setTheme(t.key)}
                aria-label={`${t.label} theme`}
                aria-pressed={theme === t.key}
              />
            ))}
          </div>
        </div>

        {isPaper && tape.length > 0 && (
          <div className="tape">
            {tape.map((line, i) => (
              <div className="tape-line" key={i}>
                <span className="tape-expr">{line.expr} =</span>
                <span className="tape-result">{line.result}</span>
              </div>
            ))}
          </div>
        )}

        <div className="expression">
          {operator ? `${prevValue} ${opSymbol(operator)}` : "\u00A0"}
        </div>

        <div className="display">
          {theme === "vintage" ? (
            <span className="vintage-display-stack">
              <span className="vintage-ghost">
                {"8".repeat(Math.max(0, 10 - display.length))}
              </span>
              <span className="vintage-real">{display}</span>
            </span>
          ) : (
            display
          )}
        </div>

        <div className="keys">
          <button className="key ghost clear" onClick={handleClear}>AC</button>
          <button className="key ghost" onClick={handleBackspace}>⬅</button>
          <button className="key accent-op" onClick={() => chooseOperator("÷")}>÷</button>
          <button className="key accent-op" onClick={() => chooseOperator("x")}>×</button>

          <button className="key" onClick={() => inputDigit("7")}>7</button>
          <button className="key" onClick={() => inputDigit("8")}>8</button>
          <button className="key" onClick={() => inputDigit("9")}>9</button>
          <button className="key accent-op" onClick={() => chooseOperator("-")}>−</button>

          <button className="key" onClick={() => inputDigit("4")}>4</button>
          <button className="key" onClick={() => inputDigit("5")}>5</button>
          <button className="key" onClick={() => inputDigit("6")}>6</button>
          <button className="key accent-op" onClick={() => chooseOperator("+")}>+</button>

          <button className="key" onClick={() => inputDigit("1")}>1</button>
          <button className="key" onClick={() => inputDigit("2")}>2</button>
          <button className="key" onClick={() => inputDigit("3")}>3</button>
          <button className="key accent-eq" onClick={handleEquals}>=</button>

          <button className="key" onClick={() => inputDigit(".")}>.</button>
          <button className="key zero" onClick={() => inputDigit("0")}>0</button>
        </div>
      </div>
    </main>
  );
}