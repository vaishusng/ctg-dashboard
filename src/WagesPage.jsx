import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Wages — ADMIN ONLY. Owners set each person's hourly rate here. These numbers
// never leave the owners' view: they live in an admin-only table and feed the
// behind-the-scenes project budget math. Regular employees never see this tab.
// ---------------------------------------------------------------------------
export default function WagesPage({ staff = [], wages = [], onSave }) {
  const rateFor = (id) => {
    const row = wages.find(w => w.user_id === id);
    return row ? String(row.hourly_rate) : "";
  };

  const [drafts, setDrafts] = useState({});
  const [status, setStatus] = useState({}); // user_id -> "saved" | error text

  useEffect(() => {
    const next = {};
    for (const p of staff) next[p.id] = rateFor(p.id);
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, wages]);

  async function save(id) {
    const msg = await onSave(id, drafts[id]);
    setStatus(s => ({ ...s, [id]: msg ? msg : "saved" }));
    if (!msg) setTimeout(() => setStatus(s => ({ ...s, [id]: "" })), 2000);
  }

  return (
    <main className="page">
      <h1 className="page-title">Wages</h1>
      <p className="pay-intro">
        Set each person's hourly rate. These rates are visible only to owners and
        are used to calculate whether projects are over, under, or on budget.
        When a rate changes, only hours logged after the change use the new rate.
      </p>

      {staff.length === 0 ? (
        <p className="pay-empty">No staff accounts yet. People appear here once they sign up.</p>
      ) : (
        <div className="pay-list">
          {staff.map(p => (
            <div key={p.id} className="pay-row">
              <span className="avatar" style={{ background: p.color || "#94a3b8" }}>{p.initials}</span>
              <span className="pay-name">{p.name}</span>
              <span className="pay-unit">$</span>
              <input
                className="pay-rate-input"
                type="number" min="0" step="0.01" placeholder="0.00"
                value={drafts[p.id] ?? ""}
                onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
              />
              <span className="pay-unit">/hr</span>
              <button className="btn btn-primary" onClick={() => save(p.id)}>Save</button>
              <span className={"pay-feedback " + (status[p.id] === "saved" ? "ok" : status[p.id] ? "bad" : "")}>
                {status[p.id] === "saved" ? "Saved" : (status[p.id] || "")}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
