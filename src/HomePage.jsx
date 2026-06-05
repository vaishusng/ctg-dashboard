import { columnOf, effectiveProgress, projectColor, fmtDate, PRIORITY_COLOR } from "./data.js";

// ---------------------------------------------------------------------------
// Home — the welcome page. Live stats up top, then rows of what matters:
//   📅 Coming up (closest end dates first)
//   🔥 High priority
//   ⭐ Starred tasks
//   ⭐ Starred projects
// Click anything to jump straight to it.
// ---------------------------------------------------------------------------

function MiniTask({ task, projects, onClick }) {
  const accent = projectColor(projects, task.project);
  return (
    <button className="mini-card" style={{ borderTop: `3px solid ${accent}` }} onClick={onClick}>
      <span className="mini-title">{task.starred ? "★ " : ""}{task.title}</span>
      <span className="mini-proj" style={{ color: accent }}>{task.project}</span>
      <span className="mini-foot">
        <span className="mono mini-due">📅 {fmtDate(task.end_date)}</span>
        <span className="dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
      </span>
    </button>
  );
}

function MiniProject({ project, tasks, onClick }) {
  const eff = effectiveProgress(project, tasks);
  const color = project.color || "#64748b";
  return (
    <button className="mini-card" style={{ borderTop: `3px solid ${color}` }} onClick={onClick}>
      <span className="mini-title">★ {project.name}</span>
      <span className="mini-proj">{project.client}</span>
      <span className="mini-foot">
        <span className="bar-bg mini-bar"><span className="bar" style={{ width: `${eff}%`, background: color }} /></span>
        <span className="mono mini-pct">{eff}%</span>
      </span>
    </button>
  );
}

function Row({ title, children, empty }) {
  return (
    <section className="home-row">
      <h2 className="home-row-title">{title}</h2>
      {children.length === 0
        ? <div className="home-row-empty">{empty}</div>
        : <div className="home-row-scroll">{children}</div>}
    </section>
  );
}

export default function HomePage({ tasks, projects, user, onGo, onOpenTask, onOpenProject }) {
  const live = tasks.filter(t => !t.archived);
  const open = live.filter(t => t.progress < 100);
  const inProgress = live.filter(t => columnOf(t) === "In Progress").length;
  const blocked = live.filter(t => columnOf(t) === "Blocked").length;
  const activeProjects = projects.filter(p => effectiveProgress(p, tasks) < 100).length;

  const upcoming = open
    .filter(t => t.end_date)
    .sort((a, b) => (a.end_date < b.end_date ? -1 : 1))
    .slice(0, 8);
  const important = open
    .filter(t => t.priority === "high")
    .sort((a, b) => ((a.end_date || "9999") < (b.end_date || "9999") ? -1 : 1))
    .slice(0, 8);
  const starredTasks = live.filter(t => t.starred);
  const starredProjects = projects.filter(p => p.starred);

  return (
    <main className="page">
      <div className="eyebrow">CATALYST TECHNICAL GROUP</div>
      <h1 className="page-title">Welcome back, {user.nickname || user.name.split(" ")[0]} 👋</h1>

      {/* ---- about CTG (top, compact) ---- */}
      <section className="dash-about home-about">
        <h2>About CTG</h2>
        <p>
          Catalyst Technical Group is a civil engineering firm based in Houston, Texas,
          serving clients across Fort Bend County and the greater Houston area — taking
          projects from the first client proposal through permitting, design,
          outside-agency review, and final approval.
        </p>
        <div className="dash-services">
          {["Civil", "Structural", "MEP", "Platting", "Permit Coordination", "Drainage & Floodplain"].map(s => (
            <span key={s} className="service-tag">{s}</span>
          ))}
        </div>
      </section>

      {/* ---- live stats ---- */}
      <div className="home-stats">
        <button className="stat" onClick={() => onGo("Tasks")}>
          <span className="stat-num mono">{live.length}</span>
          <span className="stat-label">Open tasks</span>
        </button>
        <button className="stat" onClick={() => onGo("Tasks")}>
          <span className="stat-num mono">{inProgress}</span>
          <span className="stat-label">In progress</span>
        </button>
        <button className="stat stat-warn" onClick={() => onGo("Tasks")}>
          <span className="stat-num mono">{blocked}</span>
          <span className="stat-label">Blocked</span>
        </button>
        <button className="stat" onClick={() => onGo("Projects")}>
          <span className="stat-num mono">{activeProjects}</span>
          <span className="stat-label">Active projects</span>
        </button>
      </div>

      {/* ---- the rows ---- */}
      <Row title="📅 Coming up" empty="No upcoming deadlines — nice.">
        {upcoming.map(t => (
          <MiniTask key={t.id} task={t} projects={projects} onClick={() => onOpenTask(t.id)} />
        ))}
      </Row>

      <Row title="🔥 High priority" empty="Nothing urgent right now.">
        {important.map(t => (
          <MiniTask key={t.id} task={t} projects={projects} onClick={() => onOpenTask(t.id)} />
        ))}
      </Row>

      <Row title="⭐ Starred tasks" empty="Star a task with ☆ and it shows up here.">
        {starredTasks.map(t => (
          <MiniTask key={t.id} task={t} projects={projects} onClick={() => onOpenTask(t.id)} />
        ))}
      </Row>

      <Row title="⭐ Starred projects" empty="Star a project with ☆ and it shows up here.">
        {starredProjects.map(p => (
          <MiniProject key={p.id} project={p} tasks={tasks} onClick={() => onOpenProject(p.id)} />
        ))}
      </Row>

    </main>
  );
}
