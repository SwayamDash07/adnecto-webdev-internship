"use client";

interface HistoryEntry {
  name: string;
  score: number;
  skipped: number;
  wrong: number;
  date: string;
}

interface Props {
  score: number;
  skipped: number;
  history: HistoryEntry[];
  onRestart: () => void;
  onHistory: () => void;
}

export default function ResultScreen({ score, skipped, history, onRestart, onHistory }: Props) {
  const wrong = 10 - score - skipped;
  const isWin = score >= 6;

  return (
    <div style={s.centered}>
      <div style={s.wrapper}>

        <div style={s.card}>
          <img
            src={isWin ? "/win.jpeg" : "/loss.jpeg"}
            alt="result"
            style={{ ...s.resultImg, background: isWin ? "#fef9c3" : "#f3f4f6" }}
          />
          <h2 style={{ ...s.resultTitle, color: isWin ? "#15803d" : "#991b1b" }}>
            {score === 10 && "Jungle King!"}
            {score >= 8 && score < 10 && "Outstanding!"}
            {score >= 6 && score < 8 && "Well done!"}
            {score >= 4 && score < 6 && "Keep trying!"}
            {score < 4 && "Better luck next time!"}
          </h2>
          <div style={s.scoreBig}>{score}<span style={s.scoreOf}> / 10</span></div>
          <p style={s.scoreMsg}>
            {score === 10 && "Perfect! You rule the jungle!"}
            {score >= 8 && score < 10 && "Almost perfect! Sharp jungle mind!"}
            {score >= 6 && score < 8 && "Solid! You know your jungle facts."}
            {score >= 4 && score < 6 && "The jungle has more to teach you."}
            {score < 4 && "The jungle awaits your return!"}
          </p>
          <div style={s.statsRow}>
            {[
              { label: "Correct", val: score,  color: "#22c55e" },
              { label: "Wrong",   val: wrong,   color: "#ef4444" },
              { label: "Skipped", val: skipped, color: "#eab308" },
            ].map((st) => (
              <div key={st.label} style={{ ...s.statBox, borderTop: `4px solid ${st.color}` }}>
                <span style={{ ...s.statNum, color: st.color }}>{st.val}</span>
                <span style={s.statLabel}>{st.label}</span>
              </div>
            ))}
          </div>
          <button style={s.primaryBtn} onClick={onRestart}>Play Again</button>
        </div>

        {history.length > 0 && (
          <div style={s.historySnippet}>
            <p style={s.historyTitle}>Recent Games</p>
            {history.slice(0, 3).map((h, i) => (
              <div key={i} style={{
                ...s.historyRow,
                background: i === 0 ? "#f0fdf4" : "rgba(255,255,255,0.7)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    ...s.scoreBadge,
                    background: h.score >= 6 ? "#dcfce7" : "#fee2e2",
                    color: h.score >= 6 ? "#15803d" : "#991b1b",
                  }}>
                    {h.score}
                  </div>
                  <div>
                    <p style={s.hName}>{h.name}</p>
                    <p style={s.hDate}>{h.date}</p>
                  </div>
                </div>
                <div style={s.hStats}>
                  <span style={{ color: "#22c55e", fontWeight: "700" }}>{h.score} correct</span>
                  {" · "}
                  <span style={{ color: "#ef4444" }}>{h.wrong} wrong</span>
                  {" · "}
                  <span style={{ color: "#eab308" }}>{h.skipped} skipped</span>
                </div>
              </div>
            ))}
            {history.length > 3 && (
              <button style={s.viewMoreBtn} onClick={onHistory}>
                View More ({history.length - 3} more)
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  centered:       { display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
  wrapper:        { display: "flex", flexDirection: "column", gap: "16px", width: "100%", maxWidth: "480px" },
  card: {
    background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)",
    borderRadius: "20px", padding: "28px 24px", width: "100%",
    boxShadow: "0 4px 32px rgba(0,0,0,0.12)", border: "1.5px solid #e5e7eb", boxSizing: "border-box",
  },
  resultImg:   { width: "150px", height: "150px", objectFit: "contain", display: "block", margin: "0 auto 16px", borderRadius: "16px", padding: "10px" },
  resultTitle: { fontSize: "26px", fontWeight: "700", margin: "0 0 8px", textAlign: "center" },
  scoreBig:    { fontSize: "64px", fontWeight: "800", color: "#15803d", margin: "8px 0 4px", lineHeight: "1", textAlign: "center" },
  scoreOf:     { fontSize: "32px", color: "#9ca3af", fontWeight: "500" },
  scoreMsg:    { fontSize: "15px", color: "#6b7280", margin: "0 0 20px", textAlign: "center" },
  statsRow:    { display: "flex", gap: "12px", justifyContent: "center", marginBottom: "24px" },
  statBox:     { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "80px" },
  statNum:     { fontSize: "28px", fontWeight: "800" },
  statLabel:   { fontSize: "12px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" },
  primaryBtn:  { background: "#15803d", color: "#fff", border: "none", borderRadius: "12px", padding: "14px 36px", fontSize: "16px", fontWeight: "700", cursor: "pointer", display: "block", margin: "0 auto" },
  historySnippet: { background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)", borderRadius: "16px", padding: "16px 20px", border: "1.5px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" },
  historyTitle:   { fontSize: "12px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 12px" },
  historyRow:     { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", marginBottom: "8px" },
  scoreBadge:     { width: "34px", height: "34px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "14px", flexShrink: "0" as const },
  hName:          { margin: "0", fontWeight: "600", fontSize: "13px", color: "#111827" },
  hDate:          { margin: "0", fontSize: "11px", color: "#9ca3af" },
  hStats:         { fontSize: "11px", color: "#6b7280", textAlign: "right" },
  viewMoreBtn:    { background: "transparent", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", color: "#15803d", fontWeight: "600", cursor: "pointer", display: "block", margin: "8px auto 0", width: "100%" },
};