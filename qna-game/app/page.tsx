"use client";
import { useState, useEffect } from "react";
import { ALL_QUESTIONS, Question } from "./data/questions";
import { pickRandomQuestions } from "./data/helpers";
import NameScreen from "../components/screens/NameScreen";
import StartScreen from "../components/screens/StartScreen";
import QuizScreen from "../components/screens/QuizScreen";
import ResultScreen from "../components/screens/ResultScreen";
import HistoryScreen from "../components/screens/HistoryScreen";

interface HistoryEntry {
  name: string;
  score: number;
  skipped: number;
  wrong: number;
  date: string;
}


export default function Home() {
  const [screen, setScreen] = useState<string>("name");
  const [playerName, setPlayerName] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [nameError, setNameError] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<number>(0);
  const [monkeyPos, setMonkeyPos] = useState<number>(0);
  const [swinging, setSwinging] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const savedName = sessionStorage.getItem("junglePlayerName");
    if (savedName) { setPlayerName(savedName); setScreen("start"); }
    const savedHistory = localStorage.getItem("jungleHistory");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    if (screen !== "result") return;
    const newEntry: HistoryEntry = {
      name: playerName, score, skipped,
      wrong: 10 - score - skipped,
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    };
    const updated = [newEntry, ...history].slice(0, 5);
    setHistory(updated);
    localStorage.setItem("jungleHistory", JSON.stringify(updated));
  }, [screen]);

  const handleNameSubmit = () => {
    if (!nameInput.trim()) { setNameError("Please enter your name!"); return; }
    sessionStorage.setItem("junglePlayerName", nameInput.trim());
    setPlayerName(nameInput.trim());
    setScreen("start");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("junglePlayerName");
    localStorage.removeItem("jungleHistory");
    setPlayerName(""); setNameInput(""); setHistory([]);
    setScreen("name");
  };

  const handleStart = () => {
    setQuestions(pickRandomQuestions(ALL_QUESTIONS, 10));
    setCurrent(0); setScore(0); setSkipped(0);
    setFeedback(null); setSelected(null);
    setMonkeyPos(0); setSwinging(false);
    setScreen("quiz");
  };

  const handleAnswer = (idx: number) => {
    if (feedback) return;
    setSelected(idx);
    if (idx === questions[current].answer) { setFeedback("correct"); setScore((s) => s + 1); }
    else setFeedback("wrong");
    triggerSwing();
  };

  const handleSkip = () => {
    if (feedback) return;
    setFeedback("skipped");
    setSkipped((s) => s + 1);
    triggerSwing();
  };

  const triggerSwing = () => {
    setSwinging(true);
    setTimeout(() => {
      setSwinging(false);
      setMonkeyPos((p) => Math.min(p + 1, 9));
      next();
    }, 1000);
  };

  const next = () => {
    setFeedback(null); setSelected(null);
    if (current + 1 >= questions.length) setScreen("result");
    else setCurrent((c) => c + 1);
  };

  const handleEndSession = () => {
    const remaining = questions.length - current - 1;
    setSkipped((s) => s + remaining);
    setScreen("result");
  };

  return (
    <div style={page}>
      <style>{`
        @keyframes swingIdle {
          0%   { transform: rotate(-4deg); }
          50%  { transform: rotate(4deg);  }
          100% { transform: rotate(-4deg); }
        }
        @keyframes swingAcross {
          0%   { transform: translateX(0px)  rotate(0deg);  opacity: 1;   }
          40%  { transform: translateX(30px) rotate(15deg); opacity: 1;   }
          100% { transform: translateX(80px) rotate(5deg);  opacity: 0.2; }
        }
        .monkey-idle     { transform-origin: top center; animation: swingIdle 2s ease-in-out infinite; }
        .monkey-swinging { transform-origin: top center; animation: swingAcross 0.9s ease-in-out forwards; }
        input:focus { outline: 2px solid #86efac; }
        button:hover { opacity: 0.9; transform: scale(1.02); transition: all 0.15s; }
      `}</style>

      {screen === "name" && <NameScreen nameInput={nameInput} setNameInput={setNameInput} nameError={nameError} setNameError={setNameError} onSubmit={handleNameSubmit} />}
      {screen === "start" && <StartScreen playerName={playerName} hasHistory={history.length > 0} onStart={handleStart} onHistory={() => setScreen("history")} onLogout={handleLogout} />}
      {screen === "quiz" && questions.length > 0 && <QuizScreen question={questions[current]} current={current} total={questions.length} playerName={playerName} feedback={feedback} selected={selected} monkeyPos={monkeyPos} swinging={swinging} onAnswer={handleAnswer} onSkip={handleSkip} onEndSession={handleEndSession} />}
      {screen === "result" && <ResultScreen score={score} skipped={skipped} history={history} onRestart={() => setScreen("start")} onHistory={() => setScreen("history")} />}
      {screen === "history" && <HistoryScreen history={history} onBack={() => setScreen("start")} />}
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "url('/backg.png') center center / cover no-repeat fixed",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  padding: "24px 16px",
  overflowX: "hidden",
};

const logoutBtn: React.CSSProperties = {
  background: "#991b1b",
  border: "none",
  borderRadius: "10px",
  padding: "10px 20px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#fff",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};