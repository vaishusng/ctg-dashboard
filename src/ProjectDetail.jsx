import { useState } from "react";
import TaskCard from "./TaskCard.jsx";
import ProjectModal from "./ProjectModal.jsx";
import TaskModal from "./TaskModal.jsx";
import ProjectReport from "./ProjectReport.jsx";
import NoteFeed from "./NoteFeed.jsx";
import {
  STAGES, PRIORITY_RANK, TASK_TYPES, TASK_TYPE_COLOR,
  fmtDate, columnOf, effectiveProgress,
} from "./data.js";

const DECISION_STATUSES = ["Pending", "In Review", "Approved"];

// ---------------------------------------------------------------------------
// One project's page with three views:
//   • Overview — info, team, MILESTONES (+ timeline), DECISIONS, and the
//     chat-style Updates & Roadblocks feeds
//   • Tasks    — this project's tasks grouped by discipline
//   • Report   — a printable / Word-exportable status report
// ---------------------------------------------------------------------------

export default function ProjectDetail({
  project, tasks, people, projects,
  milestones = [], decisions = [], projectNotes = [], user,
  onAddMilestone, onUpdateMilestone, onDeleteMilestone,
  onAddDecision, onUpdateDecision, onDeleteDecision,
  onAddNote, onEditNote, onDeleteNote,
  onOpenTask, onAddTask, onBack, onUpdateProject, onToggleStar, onArchive, onTrashTask,
}) {
  const [view, setView] = useState("overview");

  // tasks-view controls
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("Priority");
  const [sortDir, setSortDir] = useState("High to Low");
  const [filterOpen, setFilterOpen] = useState(false);
  const [excluded, setExcluded] = useState({ stages: [], assignees: [], statuses: [] });

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // milestone add/edit
  const [newMs, setNewMs] = useState({ title: "", detail: "", due: "" });
  const [editMsId, setEditMsId] = useState(null);
  const [editMs, setEditMs] = useState({ title: "", detail: "", due: "" });

  // decision add/edit
  const [newDec, setNewDec] = useState({ owner: "", description: "", deadline: "", status: "Pending" });
  const [editDecId, setEditDecId] = useState(null);
  const [editDec, setEditDec] = useState({ owner: "", description: "", deadline: "", status: "Pending" });

  const projTasks = tasks.filter(t => t.project === project.name && !t.archived);
  const color = project.color || "#64748b";
  const eff = effectiveProgress(project, tasks);

  const manager = people.find(p => p.initials === project.manager);
  const projAssignees = (project.assignees || []).map(i => people.find(p => p.initials === i)).filter(Boolean);

  const sortedMs = [...milestones].sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);

  function addMs() {
    if (!newMs.title.trim()) return;
    onAddMilestone({ title: newMs.title.trim(), detail: newMs.detail.trim(), due: newMs.due || null, done: false });
    setNewMs({ title: "", detail: "", due: "" });
  }
  function startEditMs(m) {
    setEditMsId(m.id);
    setEditMs({ title: m.title, detail: m.detail || "", due: m.due || "" });
  }
  function saveEditMs() {
    onUpdateMilestone(editMsId, { title: editMs.title.trim(), detail: editMs.detail.trim(), due: editMs.due || null });
    setEditMsId(null);
  }

  function addDec() {
    if (!newDec.description.trim()) return;
    onAddDecision({ owner: newDec.owner.trim(), description: newDec.description.trim(), deadline: newDec.deadline || null, status: newDec.status });
    setNewDec({ owner: "", description: "", deadline: "", status: "Pending" });
  }
  function startEditDec(d) {
    setEditDecId(d.id);
    setEditDec({ owner: d.owner || "", description: d.description, deadline: d.deadline || "", status: d.status });
  }
  function saveEditDec() {
    onUpdateDecision(editDecId, { owner: editDec.owner.trim(), description: editDec.description.trim(), deadline: editDec.deadline || null, status: editDec.status });
    setEditDecId(null);
  }

  // tasks-view filtering
  function toggleExcluded(group, value) {
    setExcluded(prev => {
      const list = prev[group];
      return { ...prev, [group]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
    });
  }
  const activeFilters = excluded.stages.length + excluded.assignees.length + excluded.statuses.length;
  function passes(t) {
    if (excluded.stages.includes(t.stage)) return false;
    if (excluded.statuses.includes(columnOf(t))) return false;
    if (t.assignees.length && t.assignees.every(a => excluded.assignees.includes(a))) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }
  function sortKey(t) {
    if (sortField === "Priority") return PRIORITY_RANK[t.priority];
    if (sortField === "Date") return t.end_date || "9999-12-31";
    return t.hours;
  }
  function compare(a, b) {
    const ka = sortKey(a), kb = sortKey(b);
    const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
    return sortDir === "High to Low" ? -cmp : cmp;
  }
  const visible = projTasks.filter(passes);
  const hasUnsorted = visible.some(t => !TASK_TYPES.includes(t.type));
  const typeColumns = [...TASK_TYPES, ...(hasUnsorted ? ["Unsorted"] : [])];

  return (
    <main className="page">
      <button className="btn" onClick={onBack}>← Back to projects</button>

      {/* ---- header (now holds About + Team) ---- */}
      <div className="pd-header" style={{ borderTop: `4px solid ${color}` }}>
        <div className="pd-header-top">
          <div className="pd-left">
            <div className="eyebrow">CATALYST TECHNICAL GROUP</div>
            <h1 className="pd-title">{project.starred ? "★ " : ""}{project.name}</h1>
            <div className="proj-meta">
              <span className="detail-clientbox proj-client">{project.client}</span>
              <span className="proj-due mono">📅 {fmtDate(project.due)}</span>
              <span className="pd-count mono">{projTasks.length} task{projTasks.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="pd-right">
            <div className="proj-progrow">
              <div className="bar-bg bar-bg-lg"><div className="bar" style={{ width: `${eff}%`, background: color }} /></div>
              <span className="mono detail-pct">{eff}%</span>
              {project.auto && <span className="auto-badge mono" title="Hours-weighted average of this project's tasks">AUTO</span>}
            </div>
            <div className="pd-btnrow">
              <button className="btn btn-primary" onClick={() => setAddOpen(true)}>＋ New task</button>
              <button className="btn" onClick={() => setEditOpen(true)}>✎ Edit project</button>
            </div>
          </div>
        </div>

        <div className="pd-header-info">
          <div className="pd-hcell">
            <h3 className="pd-hcell-title">About</h3>
            {project.description ? <p className="proj-desc">{project.description}</p> : <span className="pd-muted">No description yet.</span>}
          </div>
          <div className="pd-hcell">
            <h3 className="pd-hcell-title">Team</h3>
            <div className="pd-team-row">
              <div>
                <div className="pd-label">Project manager</div>
                {manager ? (
                  <span className="pd-person"><span className="avatar" style={{ background: manager.color }}>{manager.initials}</span>{manager.name}</span>
                ) : <span className="pd-muted">Not set — assign via ✎ Edit project</span>}
              </div>
              <div>
                <div className="pd-label">Assignees</div>
                {projAssignees.length ? (
                  <div className="avatar-row">
                    {projAssignees.map(p => <span key={p.initials} className="avatar" style={{ background: p.color }} title={p.name}>{p.initials}</span>)}
                  </div>
                ) : <span className="pd-muted">None yet</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- view toggle ---- */}
      <div className="pd-tabs">
        <button className={view === "overview" ? "tab tab-active" : "tab"} onClick={() => setView("overview")}>Overview</button>
        <button className={view === "tasks" ? "tab tab-active" : "tab"} onClick={() => setView("tasks")}>Tasks ({projTasks.length})</button>
        <button className={view === "report" ? "tab tab-active" : "tab"} onClick={() => setView("report")}>📄 Report</button>
      </div>

      {/* ================= OVERVIEW ================= */}
      {view === "overview" && (
        <div className="pd-overview">
          {/* ---- timeline (full width) ---- */}
          <section className="pd-card full">
            <h2>Timeline</h2>
            {sortedMs.length === 0 ? (
              <span className="pd-muted">Add milestones below to build the timeline.</span>
            ) : (
              <div className="timeline">
                <div className="timeline-line" />
                {sortedMs.map(m => (
                  <div key={m.id} className="timeline-node">
                    <span className={"timeline-dot" + (m.done ? " done" : "")} style={m.done ? { background: color, borderColor: color } : {}} />
                    <div className="timeline-label">
                      <div className="timeline-title">{m.title}</div>
                      <div className="timeline-date mono">{m.due ? fmtDate(m.due) : "no date"}</div>
                      <div className="timeline-actions">
                        <button className="note-link" onClick={() => { startEditMs(m); }}>Edit</button>
                        <button className="note-link note-link-danger" onClick={() => onDeleteMilestone(m.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="pd-cols">
            <div className="pd-col">
          {/* ---- milestones ---- */}
          <section className="pd-card">
            <h2>Milestones</h2>
            <p className="pd-hint">Key checkpoints. Tick them off as you hit them.</p>
            <div className="ms-list">
              {sortedMs.map(m => (
                <div key={m.id} className="ms-row">
                  {editMsId === m.id ? (
                    <div className="ms-edit">
                      <input value={editMs.title} onChange={e => setEditMs({ ...editMs, title: e.target.value })} placeholder="Title" />
                      <input value={editMs.detail} onChange={e => setEditMs({ ...editMs, detail: e.target.value })} placeholder="Detail" />
                      <input type="date" value={editMs.due} onChange={e => setEditMs({ ...editMs, due: e.target.value })} />
                      <button className="btn btn-primary" onClick={saveEditMs}>Save</button>
                      <button className="btn" onClick={() => setEditMsId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <label className="check ms-check">
                        <input type="checkbox" checked={!!m.done} onChange={() => onUpdateMilestone(m.id, { done: !m.done })} />
                      </label>
                      <div className="ms-main">
                        <span className={"ms-title" + (m.done ? " ms-done" : "")}>{m.title}</span>
                        {m.detail && <span className="ms-detail"> — {m.detail}</span>}
                      </div>
                      <span className="ms-due mono">{m.due ? fmtDate(m.due) : "—"}</span>
                      <div className="ms-actions">
                        <button className="note-link" onClick={() => startEditMs(m)}>Edit</button>
                        <button className="note-link note-link-danger" onClick={() => onDeleteMilestone(m.id)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="ms-add">
              <input value={newMs.title} onChange={e => setNewMs({ ...newMs, title: e.target.value })} placeholder="New milestone title" />
              <input value={newMs.detail} onChange={e => setNewMs({ ...newMs, detail: e.target.value })} placeholder="Detail (optional)" />
              <input type="date" value={newMs.due} onChange={e => setNewMs({ ...newMs, due: e.target.value })} />
              <button className="btn btn-primary" onClick={addMs}>＋ Add</button>
            </div>
          </section>

          {/* ---- decisions ---- */}
          <section className="pd-card">
            <h2>Decisions Needed</h2>
            <p className="pd-hint">Open questions waiting on someone's call.</p>
            <table className="dec-table">
              <thead><tr><th>Owner</th><th>Decision</th><th>Deadline</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {decisions.length === 0 && <tr><td colSpan="5" className="pd-muted">None yet.</td></tr>}
                {decisions.map(d => editDecId === d.id ? (
                  <tr key={d.id}>
                    <td><input value={editDec.owner} onChange={e => setEditDec({ ...editDec, owner: e.target.value })} /></td>
                    <td><input value={editDec.description} onChange={e => setEditDec({ ...editDec, description: e.target.value })} /></td>
                    <td><input type="date" value={editDec.deadline} onChange={e => setEditDec({ ...editDec, deadline: e.target.value })} /></td>
                    <td>
                      <select value={editDec.status} onChange={e => setEditDec({ ...editDec, status: e.target.value })}>
                        {DECISION_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="note-link" onClick={saveEditDec}>Save</button>
                      <button className="note-link" onClick={() => setEditDecId(null)}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id}>
                    <td>{d.owner || "—"}</td>
                    <td>{d.description}</td>
                    <td className="mono">{d.deadline ? fmtDate(d.deadline) : "—"}</td>
                    <td><span className="dec-status">{d.status}</span></td>
                    <td>
                      <button className="note-link" onClick={() => startEditDec(d)}>Edit</button>
                      <button className="note-link note-link-danger" onClick={() => onDeleteDecision(d.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dec-add">
              <input value={newDec.owner} onChange={e => setNewDec({ ...newDec, owner: e.target.value })} placeholder="Owner" />
              <input value={newDec.description} onChange={e => setNewDec({ ...newDec, description: e.target.value })} placeholder="Decision needed" />
              <input type="date" value={newDec.deadline} onChange={e => setNewDec({ ...newDec, deadline: e.target.value })} />
              <select value={newDec.status} onChange={e => setNewDec({ ...newDec, status: e.target.value })}>
                {DECISION_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary" onClick={addDec}>＋ Add</button>
            </div>
          </section>
            </div>{/* end left column */}

            <div className="pd-col">
          {/* ---- chat-style updates + roadblocks ---- */}
          <NoteFeed
            title="Project updates"
            hint="What's happening, what the client has given us, recent progress."
            placeholder="Share an update..."
            notes={projectNotes.filter(n => n.kind === "update")}
            user={user}
            onAdd={(text) => onAddNote("update", text)}
            onEdit={onEditNote}
            onDelete={onDeleteNote}
          />
          <NoteFeed
            title="Roadblocks"
            hint="Anything blocking the team — waiting on the client, a permit, a decision."
            placeholder="Note a roadblock..."
            notes={projectNotes.filter(n => n.kind === "roadblock")}
            user={user}
            onAdd={(text) => onAddNote("roadblock", text)}
            onEdit={onEditNote}
            onDelete={onDeleteNote}
          />
            </div>{/* end right column */}
          </div>{/* end pd-cols */}
        </div>
      )}

      {/* ================= TASKS ================= */}
      {view === "tasks" && (
        <>
          <div className="controls">
            <div className="filter-wrap">
              <button className={activeFilters ? "btn btn-primary" : "btn"} onClick={() => setFilterOpen(o => !o)}>
                ⛃ Filter{activeFilters ? ` (${activeFilters})` : ""}
              </button>
              {filterOpen && (
                <div className="filter-panel">
                  <div className="filter-group">
                    <div className="filter-title">Status</div>
                    {["Not Started", "In Progress", "Completed", "Blocked"].map(s => (
                      <label key={s} className="check"><input type="checkbox" checked={!excluded.statuses.includes(s)} onChange={() => toggleExcluded("statuses", s)} /> {s}</label>
                    ))}
                  </div>
                  <div className="filter-group">
                    <div className="filter-title">Stages</div>
                    {STAGES.map(s => (
                      <label key={s} className="check"><input type="checkbox" checked={!excluded.stages.includes(s)} onChange={() => toggleExcluded("stages", s)} /> {s}</label>
                    ))}
                  </div>
                  <div className="filter-group">
                    <div className="filter-title">Assignees</div>
                    {people.map(p => (
                      <label key={p.initials} className="check"><input type="checkbox" checked={!excluded.assignees.includes(p.initials)} onChange={() => toggleExcluded("assignees", p.initials)} /> {p.initials} — {p.name}</label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <label className="control"><span>Sort by</span>
              <select value={sortField} onChange={e => setSortField(e.target.value)}><option>Priority</option><option>Date</option><option>Time</option></select>
            </label>
            <label className="control"><span>Order</span>
              <select value={sortDir} onChange={e => setSortDir(e.target.value)}><option>High to Low</option><option>Low to High</option></select>
            </label>
            <input className="search" placeholder="🔍  Search this project's tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="board-disc">
            {typeColumns.map(type => {
              const colTasks = visible.filter(t => type === "Unsorted" ? !TASK_TYPES.includes(t.type) : t.type === type).sort(compare);
              const dot = TASK_TYPE_COLOR[type] || "#94a3b8";
              return (
                <section key={type} className="col">
                  <header className="col-head">
                    <span className="col-dot" style={{ background: dot }} />
                    <span className="col-name">{type}</span>
                    <span className="col-count mono">{colTasks.length}</span>
                  </header>
                  {colTasks.length === 0 && <div className="col-empty">No tasks</div>}
                  {colTasks.map(t => (
                    <TaskCard key={t.id} task={t} people={people} projects={projects}
                      onOpen={() => onOpenTask(t.id)} onDragStart={() => {}} onDragEnd={() => {}}
                      onStar={() => onToggleStar(t.id)} onArchive={() => onArchive(t.id)} onTrash={() => onTrashTask(t.id)} />
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* ================= REPORT ================= */}
      {view === "report" && (
        <ProjectReport project={project} tasks={projTasks} people={people} milestones={sortedMs} decisions={decisions} projectNotes={projectNotes} eff={eff} />
      )}

      {addOpen && (
        <TaskModal people={people} projects={projects} lockedProject={project.name} onAdd={onAddTask} onClose={() => setAddOpen(false)} />
      )}
      {editOpen && (
        <ProjectModal initial={project} people={people} autoValue={effectiveProgress({ ...project, auto: true }, tasks)} onClose={() => setEditOpen(false)} onSave={onUpdateProject} />
      )}
    </main>
  );
}
