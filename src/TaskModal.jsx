import { useEffect, useMemo, useState } from "react";
import { STAGES, PRIORITIES, TASK_TYPES } from "./data.js";

// Where the half-finished form is saved so you don't lose it if you close it.
const DRAFT_KEY = "ctg_task_draft_v1";
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Shared "New task" modal. Only TITLE, PROJECT, CLIENT, and TYPE are required.
// As you type, your progress is saved to the browser — close it and reopen and
// your half-filled form comes back. It clears once the task is actually added.
// ---------------------------------------------------------------------------

export default function TaskModal({ people, projects, lockedProject = null, onAdd, onClose }) {
  const projectNames = useMemo(() => projects.map(p => p.name), [projects]);
  const clientNames = useMemo(() => [...new Set(projects.map(p => p.client))].sort(), [projects]);

  const locked = lockedProject && projects.find(p => p.name === lockedProject);
  const blankDraft = {
    title: "", description: "",
    project: locked ? locked.name : "",
    client: locked ? locked.client : "",
    stage: STAGES[0], priority: "med", progress: 0, hours: 0,
    type: "",
    assignees: [], blocked: false, start_date: "", end_date: "",
  };
  const [draft, setDraft] = useState(() => {
    const saved = loadDraft();
    const merged = saved ? { ...blankDraft, ...saved } : blankDraft;
    // If opened from inside a project, always lock to that project/client.
    if (locked) { merged.project = locked.name; merged.client = locked.client; }
    return merged;
  });
  const [error, setError] = useState("");

  // Save the form to the browser whenever it changes.
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
  }, [draft]);

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }
  function discardForm() {
    clearDraft();
    setDraft(blankDraft);
    setError("");
  }

  function pickProject(name) {
    const proj = projects.find(p => p.name === name);
    setDraft(d => ({ ...d, project: name, client: proj ? proj.client : d.client }));
  }

  function toggleAssignee(p) {
    setDraft(d => ({
      ...d,
      assignees: d.assignees.includes(p)
        ? d.assignees.filter(x => x !== p)
        : [...d.assignees, p],
    }));
  }

  function submit(e) {
    e.preventDefault();
    if (!draft.title.trim()) return setError("Please give the task a title.");
    if (!projectNames.includes(draft.project))
      return setError("Choose one of the established projects.");
    if (!clientNames.includes(draft.client))
      return setError("Choose one of the established clients.");
    if (!TASK_TYPES.includes(draft.type))
      return setError("Choose the type of task (Architectural, Civil, Structural, MEP, Permitting, or Admin).");
    onAdd({
      ...draft,
      title: draft.title.trim(),
      progress: Number(draft.progress),
      hours: Number(draft.hours),
    });
    clearDraft();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>New task</h2>
        {projectNames.length === 0 && (
          <div className="login-error" style={{ marginBottom: 12 }}>
            There are no projects yet — create one on the Project Dashboard first.
          </div>
        )}
        <p className="required-note"><span className="req">*</span> required — everything else is optional</p>
        <div className="modal-grid">
          <label className="field">
            <span>Task title <span className="req">*</span></span>
            <input autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="field">
            <span>Project <span className="req">*</span>{lockedProject ? " (this project)" : ""}</span>
            <select value={draft.project} onChange={e => pickProject(e.target.value)} disabled={!!lockedProject}>
              <option value="">— choose a project —</option>
              {projectNames.map(n => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Client <span className="req">*</span></span>
            <select value={draft.client} onChange={e => setDraft({ ...draft, client: e.target.value })}>
              <option value="">— choose a client —</option>
              {clientNames.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Type <span className="req">*</span></span>
            <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
              <option value="">— choose a type —</option>
              {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Stage</span>
            <select value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value })}>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Estimated hours</span>
            <input type="number" min="0" step="0.5" value={draft.hours}
              onChange={e => setDraft({ ...draft, hours: e.target.value })} />
          </label>
          <label className="field">
            <span>Start date</span>
            <input type="date" value={draft.start_date}
              onChange={e => setDraft({ ...draft, start_date: e.target.value })} />
          </label>
          <label className="field">
            <span>End date</span>
            <input type="date" value={draft.end_date}
              onChange={e => setDraft({ ...draft, end_date: e.target.value })} />
          </label>
          <label className="field field-wide">
            <span>Description</span>
            <textarea rows="3" value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <div className="field field-wide">
            <span>Assignees (click to toggle)</span>
            <div className="chips">
              {people.map(p => (
                <button type="button" key={p.initials}
                  className={"chip" + (draft.assignees.includes(p.initials) ? " chip-on" : "")}
                  onClick={() => toggleAssignee(p.initials)}>{p.initials}</button>
              ))}
            </div>
          </div>
          <label className="field field-wide">
            <span>Progress: {draft.progress}%</span>
            <input type="range" min="0" max="100" value={draft.progress}
              onChange={e => setDraft({ ...draft, progress: e.target.value })} />
          </label>
          <label className="check field-wide">
            <input type="checkbox" checked={draft.blocked}
              onChange={e => setDraft({ ...draft, blocked: e.target.checked })} /> Mark as blocked
          </label>
        </div>
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
        <div className="modal-actions">
          <span className="draft-hint">Your progress is saved if you close this.</span>
          <button type="button" className="btn" onClick={discardForm}>Discard</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={projectNames.length === 0}>Add task</button>
        </div>
      </form>
    </div>
  );
}
