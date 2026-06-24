"use client";
import { useEffect, useState } from "react";
import MonkeyTrack from "../MonkeyTrack";

interface Question {
  question: string;
  options: string[];
  answer: number;
}

interface Props {
  question: Question;
  current: number;
  total: number;
  playerName: string;
  feedback: string | null;
  selected: number | null;
  monkeyPos: number;
  swinging: boolean;
  onAnswer: (idx: number) => void;
  onSkip: () => void;
  onEndSession: () => void;
}

export default function QuizScreen({ question, current, total, playerName, feedback, selected, monkeyPos, swinging, onAnswer, onSkip, onEndSession }: Props) {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    setTimeLeft(30);
  }, [current]);

  useEffect(() => {
    if (feedback) return;
    if (timeLeft <= 0) { onSkip(); return; }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, feedback]);

  const timerColor = timeLeft > 15 ? "#22c55e" : timeLeft > 7 ? "#eab308" : "#ef4444";
  const timerPercent = (timeLeft / 30) * 100;

  return (
    <div style={s.quizWrapper}>
      <MonkeyTrack monkeyPos={monkeyPos} swinging={swinging} />
      <div style={s.cardOuter}>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <p style={s.qLabel}>Question {current + 1} of {total}</p>
            <span style={s.playerTag}>{playerName}</span>
          </div>

          <div style={s.timerBarBg}>
            <div style={{
              ...s.timerBarFill,
              width: `${timerPercent}%`,
              background: timerColor,
              transition: "width 1s linear, background 0.5s ease",
            }} />
          </div>
          <div style={{ ...s.timerLabel, color: timerColor }}>
            {feedback ? "" : `${timeLeft}s`}
          </div>

          <h2 style={s.question}>{question.question}</h2>

          <div style={s.optionsGrid}>
            {question.options.map((opt: string, i: number) => {
              const isCorrect  = i === question.answer;
              const isSelected = i === selected;
              let bg = "#fff", border = "2px solid #e5e7eb", color = "#111827";
              if (feedback) {
                if (isCorrect)                     { bg = "#dcfce7"; border = "2px solid #22c55e"; color = "#14532d"; }
                else if (isSelected && !isCorrect) { bg = "#fee2e2"; border = "2px solid #ef4444"; color = "#7f1d1d"; }
              }
              return (
                <button key={i} style={{ ...s.optionBtn, background: bg, border, color }}
                  onClick={() => onAnswer(i)} disabled={!!feedback}>
                  <span style={s.optLetter}>{String.fromCharCode(65 + i)}</span>{opt}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div style={{
              ...s.feedbackBanner,
              background:   feedback === "correct" ? "#dcfce7" : feedback === "wrong" ? "#fee2e2" : "#fef9c3",
              color:        feedback === "correct" ? "#14532d" : feedback === "wrong" ? "#7f1d1d" : "#713f12",
              borderLeft: `4px solid ${feedback === "correct" ? "#22c55e" : feedback === "wrong" ? "#ef4444" : "#eab308"}`,
            }}>
              {feedback === "correct" && "Correct! Great job!"}
              {feedback === "wrong"   && `The answer was: ${question.options[question.answer]}`}
              {feedback === "skipped" && "Skipped — no worries!"}
            </div>
          )}

          {!feedback && (
            <div style={s.bottomRow}>
              <button style={s.skipBtn} onClick={onSkip}>Skip this one</button>
              <button style={s.endBtn} onClick={onEndSession}>End Session</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  quizWrapper: { display: "flex", flexDirection: "column", alignItems: "center", gap: "32px", width: "100%", maxWidth: "680px" },
  cardOuter:   { position: "relative", width: "100%", maxWidth: "480px" },
  card: {
    background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)",
    borderRadius: "20px", padding: "28px 24px", width: "100%",
    boxShadow: "0 4px 32px rgba(0,0,0,0.12)", border: "1.5px solid #e5e7eb",
    position: "relative", zIndex: 1, boxSizing: "border-box",
  },
  cardHeader:   { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  qLabel:       { fontSize: "12px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", margin: "0" },
  playerTag:    { fontSize: "12px", color: "#9ca3af", fontWeight: "600" },
  timerBarBg:   { width: "100%", height: "6px", background: "#e5e7eb", borderRadius: "999px", marginBottom: "4px", overflow: "hidden" },
  timerBarFill: { height: "100%", borderRadius: "999px" },
  timerLabel:   { fontSize: "12px", fontWeight: "700", textAlign: "right", marginBottom: "12px" },
  question:     { fontSize: "18px", fontWeight: "600", color: "#111827", margin: "0 0 20px", lineHeight: "1.5" },
  optionsGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" },
  optionBtn: {
    border: "2px solid #e5e7eb", borderRadius: "10px", padding: "12px 10px", fontSize: "14px",
    fontWeight: "500", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center",
    gap: "8px", transition: "border 0.15s, background 0.15s", background: "#fff", color: "#111827",
  },
  optLetter:      { fontWeight: "800", color: "#15803d", fontSize: "15px", minWidth: "18px" },
  feedbackBanner: { borderRadius: "10px", padding: "12px 16px", fontSize: "14px", fontWeight: "600", marginBottom: "10px", textAlign: "left" },
  bottomRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" },
  skipBtn: {
    background: "transparent", border: "1px solid #e5e7eb", borderRadius: "8px",
    padding: "8px 16px", fontSize: "13px", color: "#6b7280", cursor: "pointer",
  },
  endBtn: {
    background: "transparent", border: "1px solid #fca5a5", borderRadius: "8px",
    padding: "8px 16px", fontSize: "13px", color: "#ef4444", fontWeight: "600", cursor: "pointer",
  },
};