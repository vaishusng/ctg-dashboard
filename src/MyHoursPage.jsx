import { useState } from "react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
}

// ---------------------------------------------------------------------------
// My Hours — everyone logs their OWN time. Pick a project (required) and the
// number of hours (required); the task is optional. The hourly rate is stamped
// on each entry automatically in the background.
// ---------------------------------------------------------------------------
export default function MyHoursPage({ projects = [], tasks = [], logs = [], onAdd, onUpdate, onDelete }) {
  const active = projects;
  const projById = (id) => active.find(p => p.id === Number(id));
  const nameOf = (id) => active.find(p => p.id === id)?.name || "(project removed)";
  const taskTitle = (id) => tasks.find(t => t.id === id)?.title || "";
  // tasks belonging to a given project id (tasks link to a project by name)
  const tasksForProject = (projId) => {
    const p = projById(projId);
    return p ? tasks.filter(t => t.project === p.name && !t.archived) : [];
  };

  const [form, setForm] = useState({ project_id: "", task_id: "", hours: "", work_date: todayISO(), note: "" });
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  function submit() {
    if (!form.project_id) return setErr("Pick a project.");
    if (!(Number(form.hours) > 0)) return setErr("Enter how many hours, more than 0.");
    setErr("");
    onAdd({
      project_id: Number(form.project_id),
      task_id: form.task_id ? Number(form.task_id) : null,
      hours: Number(form.hours),
      work_date: form.work_date || todayISO(),
      note: form.note.trim(),
    });
    setForm({ project_id: form.project_id, task_id: "", hours: "", work_date: form.work_date, note: "" });
  }

  function startEdit(log) {
    setEditId(log.id);
    setEditDraft({
      project_id: log.project_id, task_id: log.task_id || "",
      hours: String(log.hours), work_date: log.work_date, note: log.note || "",
    });
  }
  function saveEdit() {
    onUpdate(editId, {
      project_id: Number(editDraft.project_id),
      task_id: editDraft.task_id ? Number(editDraft.task_id) : null,
      hours: Number(editDraft.hours) || 0,
      work_date: editDraft.work_date,
      note: (editDraft.note || "").trim(),
    });
    setEditId(null);
  }

  const totalHours = logs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const formTasks = tasksForProject(form.project_id);
  const editTasks = tasksForProject(editDraft.project_id);

  return (
    <main className="page">
      <h1 className="page-title">My Hours</h1>

      <div className="pay-form">
        <label className="field">
          <span>Project *</span>
          <select value={form.project_id}
            onChange={e => setForm(f => ({ ...f, project_id: e.target.value, task_id: "" }))}>
            <option value="">Select...</option>
            {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Task (optional)</span>
          <select value={form.task_id} disabled={!form.project_id}
            onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}>
            <option value="">— none —</option>
            {formTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Hours *</span>
          <input type="number" min="0" step="0.25" style={{ width: 90 }}
            value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={form.work_date}
            onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} />
        </label>
        <label className="field field-note">
          <span>Note (optional)</span>
          <input type="text" placeholder="What did you work on?"
            value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </label>
        <button className="btn btn-primary" onClick={submit}>Log hours</button>
      </div>
      {err && <p className="pay-error">{err}</p>}

      <div className="pay-sectionhead">
        <h2>Logged entries</h2>
        <span className="pay-total">{totalHours} hour{totalHours === 1 ? "" : "s"} total</span>
      </div>

      {logs.length === 0 ? (
        <p className="pay-empty">No hours logged yet. Use the form above to add your first entry.</p>
      ) : (
        <div className="pay-list">
          {logs.map(log => (
            <div key={log.id} className="pay-row">
              {editId === log.id ? (
                <>
                  <select value={editDraft.project_id}
                    onChange={e => setEditDraft(d => ({ ...d, project_id: e.target.value, task_id: "" }))}>
                    {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={editDraft.task_id} disabled={!editDraft.project_id}
                    onChange={e => setEditDraft(d => ({ ...d, task_id: e.target.value }))}>
                    <option value="">— none —</option>
                    {editTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <input type="number" min="0" step="0.25" style={{ width: 70 }}
                    value={editDraft.hours} onChange={e => setEditDraft(d => ({ ...d, hours: e.target.value }))} />
                  <input type="date" value={editDraft.work_date}
                    onChange={e => setEditDraft(d => ({ ...d, work_date: e.target.value }))} />
                  <input type="text" style={{ flex: 1 }} value={editDraft.note}
                    onChange={e => setEditDraft(d => ({ ...d, note: e.target.value }))} />
                  <div className="pay-actions">
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="pay-date">{fmt(log.work_date)}</span>
                  <span className="pay-project">
                    {nameOf(log.project_id)}
                    {log.task_id ? <span className="pay-tasktag"> • {taskTitle(log.task_id)}</span> : null}
                  </span>
                  <span className="pay-hours">{log.hours} h</span>
                  <span className="pay-note">{log.note}</span>
                  <div className="pay-actions">
                    <button className="note-link" onClick={() => startEdit(log)}>Edit</button>
                    <button className="note-link note-link-danger" onClick={() => onDelete(log.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
