"use client";

interface Props {
  nameInput: string;
  setNameInput: (val: string) => void;
  nameError: string;
  setNameError: (val: string) => void;
  onSubmit: () => void;
}

export default function NameScreen({ nameInput, setNameInput, nameError, setNameError, onSubmit }: Props) {
  return (
    <div style={s.centered}>
      <div style={s.card}>
        <img src="/progress-removebg-preview.png" alt="monkey" style={s.monkey} />
        <h1 style={s.title}>Jungle Quiz</h1>
        <p style={s.sub}>Enter your name to begin</p>
        <input
          type="text"
          placeholder="Your name..."
          value={nameInput}
          onChange={(e) => { setNameInput(e.target.value); setNameError(""); }}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          style={s.input}
        />
        {nameError && <p style={s.error}>{nameError}</p>}
        <button style={s.btn} onClick={onSubmit}>Let's Go</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  centered: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
  card: {
    background: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)",
    borderRadius: "20px", padding: "40px 32px", maxWidth: "420px", width: "100%",
    boxShadow: "0 4px 32px rgba(0,0,0,0.12)", border: "1.5px solid #e5e7eb", textAlign: "center",
  },
  monkey: { width: "140px", height: "140px", objectFit: "contain", display: "block", margin: "0 auto 16px" },
  title:  { fontSize: "30px", fontWeight: "700", color: "#14532d", margin: "0 0 8px" },
  sub:    { fontSize: "14px", color: "#6b7280", margin: "0 0 20px" },
  input: {
    width: "100%", padding: "12px 16px", fontSize: "15px", border: "1.5px solid #e5e7eb",
    borderRadius: "10px", marginBottom: "8px", boxSizing: "border-box", fontFamily: "inherit", color: "#111827",
  },
  error: { color: "#ef4444", fontSize: "13px", margin: "0 0 10px", textAlign: "left" },
  btn: {
    background: "#15803d", color: "#fff", border: "none", borderRadius: "12px",
    padding: "14px 36px", fontSize: "16px", fontWeight: "700", cursor: "pointer", display: "block", margin: "0 auto",
  },
};