"use client";

interface Props {
  playerName: string;
  hasHistory: boolean;
  onStart: () => void;
  onHistory: () => void;
  onLogout: () => void;
}

export default function StartScreen({ playerName, hasHistory, onStart, onHistory, onLogout }: Props) {
  return (
    <div style={s.centered}>
      <div style={s.card}>
        <div style={s.logoutWrap}>
          <button style={s.logoutBtn} onClick={onLogout}>Log out</button>
        </div>

        <img src="/progress-removebg-preview.png" alt="monkey" style={s.monkey} />
        <h1 style={s.title}>Hey, {playerName}!</h1>
        <div style={s.challengeBox}>
          <span style={s.challengeText}>Ready for the challenge?</span>
        </div>
        <p style={s.hint}>10 questions <br></br> Swing through the jungle</p>
        <div style={s.btnRow}>
          <button style={s.primaryBtn} onClick={onStart}>Get Started</button>
          {hasHistory && (
            <button style={s.ghostBtn} onClick={onHistory}>View History</button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  centered: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
  card: {
    background: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)",
    borderRadius: "20px", padding: "40px 32px", maxWidth: "420px", width: "100%",
    boxShadow: "0 4px 32px rgba(0,0,0,0.12)", border: "1.5px solid #e5e7eb",
    textAlign: "center", position: "relative",
  },
  logoutWrap: {
    position: "absolute", top: "16px", right: "16px",
  },
  logoutBtn: {
    background: "#991b1b", border: "none", borderRadius: "8px",
    padding: "6px 14px", fontSize: "12px", fontWeight: "700",
    color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  monkey:        { width: "140px", height: "140px", objectFit: "contain", display: "block", margin: "0 auto 16px" },
  title:         { fontSize: "30px", fontWeight: "700", color: "#14532d", margin: "0 0 14px" },
  challengeBox:  { display: "inline-block", borderRadius: "12px", padding: "10px 24px", marginBottom: "12px" },
  challengeText: { fontSize: "17px", fontWeight: "600", color: "#15803d" },
  hint:          { fontSize: "13px", color: "#6b7280", margin: "0 0 24px" },
  btnRow:        { display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" },
  primaryBtn:    { background: "#15803d", color: "#fff", border: "none", borderRadius: "12px", padding: "14px 36px", fontSize: "16px", fontWeight: "700", cursor: "pointer" },
  ghostBtn:      { background: "rgba(255,255,255,0.8)", color: "#15803d", border: "2px solid #86efac", borderRadius: "12px", padding: "14px 24px", fontSize: "16px", fontWeight: "700", cursor: "pointer" },
};