import { useState } from "react";
import { AVATAR_COLORS } from "./data.js";

// ---------------------------------------------------------------------------
// Shared modal for creating/editing a project: color, manager, assignees,
// and the auto/manual progress. The color is what every task in the project
// wears on the board.
// ---------------------------------------------------------------------------

const emptyDraft = {
  name: "", client: "", due: "", description: "", progress: 0,
  color: AVATAR_COLORS[0],
  auto: true,
  manager: "",
  assignees: [],
};

export default function ProjectModal({ initial, people = [], autoValue = null, isAdmin = false, initialBudget = 0, onClose, onSave }) {
  const [draft, setDraft] = useState(
    initial ? { ...emptyDraft, ...initial, budget: initialBudget } : { ...emptyDraft, budget: initialBudget }
  );

  function toggleAssignee(i) {
    setDraft(d => ({
      ...d,
      assignees: (d.assignees || []).includes(i)
        ? d.assignees.filter(x => x !== i)
        : [...(d.assignees || []), i],
    }));
  }

  function submit(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      client: draft.client.trim() || "—",
      description: draft.description.trim(),
      progress: Number(draft.progress),
      ...(isAdmin ? { budget: Number(draft.budget) || 0 } : {}),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>{initial ? "Edit project" : "New project"}</h2>
        <div className="modal-grid">
          <label className="field">
            <span>Project name</span>
            <input autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Client</span>
            <input value={draft.client} onChange={e => setDraft({ ...draft, client: e.target.value })} />
          </label>
          <label className="field">
            <span>Delivery date</span>
            <input type="date" value={draft.due || ""} onChange={e => setDraft({ ...draft, due: e.target.value })} />
          </label>
          {isAdmin && (
            <label className="field">
              <span>Budget (owners only)</span>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={draft.budget ?? ""} onChange={e => setDraft({ ...draft, budget: e.target.value })} />
            </label>
          )}
          <label className="field">
            <span>Project manager</span>
            <select value={draft.manager || ""} onChange={e => setDraft({ ...draft, manager: e.target.value })}>
              <option value="">— none —</option>
              {people.map(p => <option key={p.initials} value={p.initials}>{p.initials} — {p.name}</option>)}
            </select>
          </label>
          <div className="field field-wide">
            <span>Assignees (click to toggle)</span>
            <div className="chips">
              {people.length === 0 && <span className="pd-muted">No team members yet.</span>}
              {people.map(p => (
                <button type="button" key={p.initials}
                  className={"chip" + ((draft.assignees || []).includes(p.initials) ? " chip-on" : "")}
                  onClick={() => toggleAssignee(p.initials)}>{p.initials}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Project color</span>
            <div className="swatch-row">
              {AVATAR_COLORS.map(c => (
                <button key={c} type="button"
                  className={"swatch" + (c === draft.color ? " swatch-on" : "")}
                  style={{ background: c }}
                  onClick={() => setDraft({ ...draft, color: c })}
                  aria-label={`project color ${c}`} />
              ))}
            </div>
          </div>
          <label className="field field-wide">
            <span>Description</span>
            <textarea rows="3" value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className="check field-wide">
            <input type="checkbox" checked={!!draft.auto}
              onChange={e => setDraft({ ...draft, auto: e.target.checked })} />
            Auto progress — hours-weighted average of this project's tasks (the real number, recommended)
          </label>
          <label className="field field-wide">
            <span>
              Progress: {draft.auto ? (autoValue ?? Number(draft.progress)) : draft.progress}%
              {draft.auto && <em className="modal-hint"> — auto-calculated · drag the slider to override</em>}
            </span>
            <input type="range" min="0" max="100"
              value={draft.auto ? (autoValue ?? Number(draft.progress)) : draft.progress}
              onChange={e => setDraft({ ...draft, auto: false, progress: e.target.value })} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">
            {initial ? "💾 Save changes" : "Add project"}
          </button>
        </div>
      </form>
    </div>
  );
}
