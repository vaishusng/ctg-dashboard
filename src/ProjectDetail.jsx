import { useState } from "react";
import TaskCard from "./TaskCard.jsx";
import ProjectModal from "./ProjectModal.jsx";
import TaskModal from "./TaskModal.jsx";
import { STAGES, PRIORITY_RANK, fmtDate, columnOf, effectiveProgress } from "./data.js";

// ---------------------------------------------------------------------------
// One project's page: a header with the project info, then ALL of that
// project's tasks in two side-by-side columns. Filter / sort / search work
// like the task dashboard. Click any task to open Screen 3 (still editable);
// you come back here when you're done.
// ---------------------------------------------------------------------------

export default function ProjectDetail({ project, tasks, people, projects, onOpenTask, onAddTask, onBack, onUpdateProject, onToggleStar, onArchive, onTrashTask }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("Priority");
  const [sortDir, setSortDir] = useState("High to Low");
  const [filterOpen, setFilterOpen] = useState(false);
  const [excluded, setExcluded] = useState({ stages: [], assignees: [], statuses: [] });
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const projTasks = tasks.filter(t => t.project === project.name && !t.archived);
  const color = project.color || "#64748b";
  const eff = effectiveProgress(project, tasks);

  function toggleExcluded(group, value) {
    setExcluded(prev => {
      const list = prev[group];
      return {
        ...prev,
        [group]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
      };
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
    return t.hours; // Time
  }
  function compare(a, b) {
    const ka = sortKey(a), kb = sortKey(b);
    const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
    return sortDir === "High to Low" ? -cmp : cmp;
  }

  const visible = projTasks.filter(passes).sort(compare);

  return (
    <main className="page">
      <button className="btn" onClick={onBack}>← Back to projects</button>

      {/* ---- project header ---- */}
      <div className="pd-header" style={{ borderTop: `4px solid ${color}` }}>
        <div className="pd-left">
          <div className="eyebrow">CATALYST TECHNICAL GROUP</div>
          <h1 className="pd-title">{project.name}</h1>
          <div className="proj-meta">
            <span className="detail-clientbox proj-client">{project.client}</span>
            <span className="proj-due mono">📅 {fmtDate(project.due)}</span>
            <span className="pd-count mono">{projTasks.length} task{projTasks.length === 1 ? "" : "s"}</span>
          </div>
          {project.description && <p className="proj-desc">{project.description}</p>}
        </div>
        <div className="pd-right">
          <div className="proj-progrow">
            <div className="bar-bg bar-bg-lg">
              <div className="bar" style={{ width: `${eff}%`, background: color }} />
            </div>
            <span className="mono detail-pct">{eff}%</span>
            {project.auto && <span className="auto-badge mono" title="Hours-weighted average of this project's tasks">AUTO</span>}
          </div>
          <div className="pd-btnrow">
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>＋ New task</button>
            <button className="btn" onClick={() => setEditOpen(true)}>✎ Edit project</button>
          </div>
        </div>
      </div>

      {/* ---- controls (task-dashboard style) ---- */}
      <div className="controls">
        <div className="filter-wrap">
          <button
            className={activeFilters ? "btn btn-primary" : "btn"}
            onClick={() => setFilterOpen(o => !o)}
          >
            ⛃ Filter{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          {filterOpen && (
            <div className="filter-panel">
              <div className="filter-group">
                <div className="filter-title">Status</div>
                {["Not Started", "In Progress", "Completed", "Blocked"].map(s => (
                  <label key={s} className="check">
                    <input type="checkbox" checked={!excluded.statuses.includes(s)}
                      onChange={() => toggleExcluded("statuses", s)} /> {s}
                  </label>
                ))}
              </div>
              <div className="filter-group">
                <div className="filter-title">Stages</div>
                {STAGES.map(s => (
                  <label key={s} className="check">
                    <input type="checkbox" checked={!excluded.stages.includes(s)}
                      onChange={() => toggleExcluded("stages", s)} /> {s}
                  </label>
                ))}
              </div>
              <div className="filter-group">
                <div className="filter-title">Assignees</div>
                {people.map(p => (
                  <label key={p.initials} className="check">
                    <input type="checkbox" checked={!excluded.assignees.includes(p.initials)}
                      onChange={() => toggleExcluded("assignees", p.initials)} /> {p.initials} — {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <label className="control">
          <span>Sort by</span>
          <select value={sortField} onChange={e => setSortField(e.target.value)}>
            <option>Priority</option><option>Date</option><option>Time</option>
          </select>
        </label>
        <label className="control">
          <span>Order</span>
          <select value={sortDir} onChange={e => setSortDir(e.target.value)}>
            <option>High to Low</option><option>Low to High</option>
          </select>
        </label>

        <input
          className="search"
          placeholder="🔍  Search this project's tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ---- tasks, two side-by-side columns ---- */}
      <div className="tasklist-2col">
        {visible.length === 0 && <div className="col-empty">No tasks in this project match.</div>}
        {visible.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            people={people}
            projects={projects}
            onOpen={() => onOpenTask(t.id)}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            onStar={() => onToggleStar(t.id)}
            onArchive={() => onArchive(t.id)}
            onTrash={() => onTrashTask(t.id)}
          />
        ))}
      </div>

      {addOpen && (
        <TaskModal
          people={people}
          projects={projects}
          lockedProject={project.name}
          onAdd={onAddTask}
          onClose={() => setAddOpen(false)}
        />
      )}

      {editOpen && (
        <ProjectModal
          initial={project}
          autoValue={effectiveProgress({ ...project, auto: true }, tasks)}
          onClose={() => setEditOpen(false)}
          onSave={onUpdateProject}
        />
      )}
    </main>
  );
}
