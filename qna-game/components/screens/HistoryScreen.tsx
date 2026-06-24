"use client";

interface HistoryEntry {
  name: string;
  score: number;
  skipped: number;
  wrong: number;
  date: string;
}

interface Props {
  history: HistoryEntry[];
  onBack: () => void;
}

export default function HistoryScreen({ history, onBack }: Props) {
  return (
    <div style={s.centered}>
      <div style={s.card}>
        <h2 style={s.title}>Your Last {history.length} Games</h2>
        <div style={s.list}>
          {history.map((h, i) => (
            <div key={i} style={{ ...s.row, background: i === 0 ? "#f0fdf4" : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  ...s.badge,
                  background: h.score >= 6 ? "#dcfce7" : "#fee2e2",
                  color: h.score >= 6 ? "#15803d" : "#991b1b",
                }}>
                  {h.score}
                </div>
                <div>
                  <p style={s.name}>{h.name}</p>
                  <p style={s.date}>{h.date}</p>
                </div>
              </div>
              <div style={s.stats}>
                <span style={{ color: "#22c55e", fontWeight: "700" }}>{h.score} correct</span>
                {" · "}
                <span style={{ color: "#ef4444" }}>{h.wrong} wrong</span>
                {" · "}
                <span style={{ color: "#eab308" }}>{h.skipped} skipped</span>
              </div>
            </div>
          ))}
        </div>
        <button style={s.btn} onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  centered: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%" },
  card: {
    background: "rgba(255,255,255,0.88)", backdropFilter: "blur(6px)",
    borderRadius: "20px", padding: "28px 24px", maxWidth: "480px", width: "100%",
    boxShadow: "0 4px 32px rgba(0,0,0,0.12)", border: "1.5px solid #e5e7eb", boxSizing: "border-box",
  },
  title: { fontSize: "22px", fontWeight: "700", color: "#14532d", margin: "0 0 20px", textAlign: "center" },
  list:  { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" },
  row:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "12px", border: "1.5px solid #e5e7eb" },
  badge: { width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "15px" },
  name:  { margin: "0", fontWeight: "600", fontSize: "14px", color: "#111827" },
  date:  { margin: "0", fontSize: "11px", color: "#9ca3af" },
  stats: { textAlign: "right", fontSize: "12px", color: "#6b7280" },
  btn:   { background: "#15803d", color: "#fff", border: "none", borderRadius: "12px", padding: "14px 36px", fontSize: "16px", fontWeight: "700", cursor: "pointer", display: "block", margin: "0 auto" },
};