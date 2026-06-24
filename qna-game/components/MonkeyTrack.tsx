"use client";

const DOT_POSITIONS = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];

interface Props {
  monkeyPos: number;
  swinging: boolean;
}

export default function MonkeyTrack({ monkeyPos, swinging }: Props) {
  return (
    <div style={s.trackOuter}>
      <div style={s.trackLine} />
      {DOT_POSITIONS.map((left, i) => (
        <div key={i} style={{
          ...s.dot,
          left: `${left}%`,
          background: i < monkeyPos ? "#22c55e" : i === monkeyPos ? "#15803d" : "#d1d5db",
          transform: "translate(-50%, -50%) " + (i === monkeyPos ? "scale(1.35)" : "scale(1)"),
          boxShadow: i === monkeyPos ? "0 0 0 4px #bbf7d0" : "none",
        }} />
      ))}
      <div style={{
        ...s.monkeyWrap,
        left: `${DOT_POSITIONS[Math.min(monkeyPos, 9)]}%`,
        transition: swinging ? "none" : "left 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <img
          src="/progress-removebg-preview.png"
          alt="monkey"
          className={swinging ? "monkey-swinging" : "monkey-idle"}
          style={s.monkeyImg}
        />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  trackOuter: { position: "relative", width: "100%", height: "100px" },
  trackLine:  { position: "absolute", top: "20px", left: "5%", right: "5%", height: "4px", background: "rgba(255,255,255,0.5)", borderRadius: "2px" },
  dot:        { position: "absolute", top: "20px", width: "20px", height: "20px", borderRadius: "50%", transition: "all 0.4s ease" },
  monkeyWrap: { position: "absolute", top: "34px", transform: "translateX(-50%)" },
  monkeyImg:  { width: "64px", height: "64px", objectFit: "contain", transformOrigin: "top center", display: "block" },
};