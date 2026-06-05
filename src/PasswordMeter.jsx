import { passwordStrength } from "./data.js";

// A live strength bar driven by length: longer = greener.
export default function PasswordMeter({ password }) {
  const s = passwordStrength(password);
  if (!password) return null;
  return (
    <div className="pw-meter">
      <div className="pw-meter-track">
        <div className="pw-meter-fill" style={{ width: `${s.pct}%`, background: s.color }} />
      </div>
      <span className="pw-meter-label" style={{ color: s.color }}>{s.label}</span>
    </div>
  );
}
