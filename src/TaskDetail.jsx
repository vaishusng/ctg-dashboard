import { useState } from "react";
import {
  STAGES, PRIORITIES, PRIORITY_COLOR, colorOf, projectColor, trackStatus, fmtDate,
} from "./data.js";

// ---------------------------------------------------------------------------
// Screen 3 — task detail.
// VIEW mode: task info on the left, a comments/updates panel on the right
// (like a mini team chat just for this task). The progress bar is colored by
// schedule status (green = on track, amber = falling behind, red = behind).
// EDIT mode: the full form.
// ---------------------------------------------------------------------------

export default function TaskDetail({ task, people, projects, user, mode, onEdit, onCancel, onSave, onBack, onTrash, onAddComment, onEditComment, onDeleteComment }) {
  return mode === "edit"
    ? <EditMode task={task} people={people} projects={projects} onSave={onSave} onCancel={onCancel} />
    : <ViewMode task={task} people={people} projects={projects} user={user}
        onEdit={onEdit} onBack={onBack} onTrash={onTrash}
        onAddComment={onAddComment} onEditComment={onEditComment} onDeleteComment={onDeleteComment} />;
}

// ---------------------------------------------------------------------------
function ViewMode({ task, people, projects, user, onEdit, onBack, onTrash, onAddComment, onEditComment, onDeleteComment }) {
  const accent = projectColor(projects, task.project);
  const track = trackStatus(task);
  const barColor = track ? track.color : accent;

  return (
    <main className="page">
      <button className="btn" onClick={onBack}>← Back</button>

      <div className="detail-grid">
        {/* ---- left: the task ---- */}
        <div className="detail">
          <div className="detail-top">
            <div className="detail-titlewrap">
              <h1 className="detail-title">{task.title}</h1>
              <span className="detail-projbox">{task.project}</span>
              <span className="detail-projbox">{task.client || "—"}</span>
              <span className="detail-projbox">{task.stage}</span>
            </div>
            <div className="detail-dates">
              <div className="detail-datelabel mono">START</div>
              <div>{fmtDate(task.start_date)}</div>
              <div className="detail-datelabel mono detail-datelabel-2">END</div>
              <div>{fmtDate(task.end_date)}</div>
            </div>
          </div>

          <p className="detail-desc">{task.description || "No description yet."}</p>

          <div className="detail-progrow">
            <div className="detail-progleft">
              <div className="bar-bg bar-bg-lg">
                <div className="bar" style={{ width: `${task.progress}%`, background: barColor }} />
              </div>
              <span className="mono detail-pct">{task.progress}%</span>
              {track && (
                <span className="track-label mono" style={{ color: track.color }}>{track.label}</span>
              )}
            </div>
            <div className="detail-progright">
              <span className="mono detail-time">🕐 {task.hours}h</span>
              <span className="bigdot" style={{ background: PRIORITY_COLOR[task.priority] }}
                title={`${task.priority} priority`} />
              <span className="avatars">
                {task.assignees.map(a => (
                  <span key={a} className="avatar avatar-xl2" style={{ background: colorOf(people, a) }}>{a}</span>
                ))}
              </span>
            </div>
          </div>

          <div className="detail-actions">
            <button className="btn btn-primary" onClick={onEdit}>✎ Edit</button>
            <button className="btn btn-danger" onClick={onTrash}>🗑 Move to trash</button>
          </div>
        </div>

        {/* ---- right: updates / comments ---- */}
        <TaskComments
          task={task}
          people={people}
          user={user}
          onAdd={onAddComment}
          onEdit={onEditComment}
          onDelete={onDeleteComment}
        />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function TaskComments({ task, people, user, onAdd, onEdit, onDelete }) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const comments = task.comments || [];

  function submit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  }
  function saveEdit() {
    onEdit(editingId, editText);
    setEditingId(null);
  }
  function handleDelete(id) {
    if (window.confirm("Delete this update?")) onDelete(id);
  }

  return (
    <aside className="tc-panel">
      <div className="tc-head">💬 Updates <span className="col-count mono">{comments.length}</span></div>
      <div className="tc-scroll">
        {comments.length === 0 && (
          <div className="col-empty">No updates yet — post the first one.</div>
        )}
        {comments.map(m => {
          const mine = m.initials === user.initials;
          return (
            <div key={m.id} className={"msg" + (mine ? " msg-mine" : "")}>
              <span className="avatar" style={{ background: colorOf(people, m.initials) || m.color }}>{m.initials}</span>
              <div className="msg-body">
                <div className="msg-head">
                  <span className="msg-author">{m.author}</span>
                  <span className="msg-time mono">{fmtTime(m.ts)}{m.edited ? " · edited" : ""}</span>
                  {mine && editingId !== m.id && (
                    <span className="msg-tools">
                      <button className="msg-toolbtn" title="Edit" onClick={() => { setEditingId(m.id); setEditText(m.text); }}>✎</button>
                      <button className="msg-toolbtn" title="Delete" onClick={() => handleDelete(m.id)}>🗑</button>
                    </span>
                  )}
                </div>
                {editingId === m.id ? (
                  <div className="msg-editrow">
                    <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }} />
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div className="msg-text">{m.text}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <form className="chat-compose" onSubmit={submit}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Post an update..." />
        <button type="submit" className="btn btn-primary">Post</button>
      </form>
    </aside>
  );
}

// ---------------------------------------------------------------------------
function EditMode({ task, people, projects, onSave, onCancel }) {
  const [d, setD] = useState({ ...task });

  const projectNames = [...new Set([...projects.map(p => p.name), task.project])].filter(Boolean);
  const clientNames = [...new Set([...projects.map(p => p.client), task.client])].filter(Boolean).sort();

  function pickProject(name) {
    const proj = projects.find(p => p.name === name);
    setD(prev => ({ ...prev, project: name, client: proj ? proj.client : prev.client }));
  }

  function toggleAssignee(p) {
    setD(prev => ({
      ...prev,
      assignees: prev.assignees.includes(p)
        ? prev.assignees.filter(x => x !== p)
        : [...prev.assignees, p],
    }));
  }

  function submit(e) {
    e.preventDefault();
    onSave({
      ...d,
      title: d.title.trim() || task.title,
      project: d.project,
      client: d.client || "",
      progress: Number(d.progress),
      hours: Number(d.hours),
    });
  }

  return (
    <main className="page">
      <div className="eyebrow">EDITING TK:{task.id}</div>
      <h1 className="page-title">{task.title}</h1>

      <form className="detail edit-grid" onSubmit={submit}>
        <label className="field">
          <span>Task name</span>
          <input value={d.title} onChange={e => setD({ ...d, title: e.target.value })} />
        </label>
        <label className="field">
          <span>Project (established only)</span>
          <select value={d.project} onChange={e => pickProject(e.target.value)}>
            {projectNames.map(n => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Client (established only)</span>
          <select value={d.client || ""} onChange={e => setD({ ...d, client: e.target.value })}>
            {clientNames.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Stage</span>
          <select value={d.stage} onChange={e => setD({ ...d, stage: e.target.value })}>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={d.priority} onChange={e => setD({ ...d, priority: e.target.value })}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          <span>🕐 Time (hours)</span>
          <input type="number" min="0" step="0.5" value={d.hours}
            onChange={e => setD({ ...d, hours: e.target.value })} />
        </label>
        <label className="field">
          <span>Start date</span>
          <input type="date" value={d.start_date || ""}
            onChange={e => setD({ ...d, start_date: e.target.value })} />
        </label>
        <label className="field">
          <span>End date</span>
          <input type="date" value={d.end_date || ""}
            onChange={e => setD({ ...d, end_date: e.target.value })} />
        </label>
        <label className="field field-wide">
          <span>Description</span>
          <textarea rows="4" value={d.description || ""}
            onChange={e => setD({ ...d, description: e.target.value })} />
        </label>
        <div className="field field-wide">
          <span>Assignees (click to toggle)</span>
          <div className="chips">
            {people.map(p => (
              <button type="button" key={p.initials}
                className={"chip" + (d.assignees.includes(p.initials) ? " chip-on" : "")}
                onClick={() => toggleAssignee(p.initials)}>{p.initials}</button>
            ))}
          </div>
        </div>
        <label className="field field-wide">
          <span>Progress: {d.progress}%</span>
          <input type="range" min="0" max="100" value={d.progress}
            onChange={e => setD({ ...d, progress: e.target.value })} />
        </label>
        <label className="check field-wide">
          <input type="checkbox" checked={!!d.blocked}
            onChange={e => setD({ ...d, blocked: e.target.checked })} /> Blocked
        </label>

        <div className="modal-actions field-wide">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">💾 Save changes</button>
        </div>
      </form>
    </main>
  );
}
