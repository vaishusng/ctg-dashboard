import { fmtDate, columnOf, trackStatus } from "./data.js";

// ---------------------------------------------------------------------------
// Status sections for ONE project (meta, status, tasks, risks, decisions,
// milestones). Rendered as a fragment inside ReportsPage's single report
// container — no toolbar and no cost table here; those live in ReportsPage.
// ---------------------------------------------------------------------------

function todayStr() {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function ProjectReport({
  project, tasks, people, milestones, decisions, projectNotes = [], eff, fTasks = null, taskHours = {},
}) {
  const shownTasks = fTasks ? tasks.filter(t => fTasks.includes(t.id)) : tasks;
  const total = tasks.length;
  const done = tasks.filter(t => t.progress >= 100).length;
  const blocked = tasks.filter(t => t.blocked).length;
  const inProgress = tasks.filter(t => !t.blocked && t.progress > 0 && t.progress < 100).length;
  const notStarted = tasks.filter(t => !t.blocked && t.progress <= 0).length;
  const pastDue = tasks.filter(t => { const s = trackStatus(t); return s && s.label === "Past due"; });

  const updates = projectNotes.filter(n => n.kind === "update");
  const roadblocks = projectNotes.filter(n => n.kind === "roadblock");

  const openMilestones = milestones.filter(m => !m.done).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);
  const nextMs = openMilestones[0];
  const openDecisions = decisions.filter(d => !["Approved", "Done", "Resolved"].includes(d.status));

  let status = { label: "On Track", color: "#16a34a" };
  if (eff >= 100) status = { label: "Complete", color: "#16a34a" };
  else if (blocked > 0 || pastDue.length > 0) status = { label: "Potential Risks / Delays", color: "#f59e0b" };

  const summaryBits = [
    `${project.name} is ${eff}% complete, with ${total} task${total === 1 ? "" : "s"} (${done} completed, ${inProgress} in progress, ${notStarted} not started, ${blocked} blocked).`,
  ];
  if (nextMs) summaryBits.push(`Next milestone: ${nextMs.title}${nextMs.due ? ` (due ${fmtDate(nextMs.due)})` : ""}.`);
  if (pastDue.length) summaryBits.push(`${pastDue.length} task${pastDue.length === 1 ? " is" : "s are"} past due.`);
  if (openDecisions.length) summaryBits.push(`${openDecisions.length} decision${openDecisions.length === 1 ? "" : "s"} awaiting input.`);
  const autoSummary = summaryBits.join(" ");

  const manager = people.find(p => p.initials === project.manager);

  return (
    <>
      <table className="report-meta">
        <tbody>
          <tr><th>Project Name</th><td>{project.name}</td><th>Project Manager</th><td>{manager ? manager.name : "—"}</td></tr>
          <tr><th>Client</th><td>{project.client}</td><th>Date of Report</th><td>{todayStr()}</td></tr>
          <tr><th>Overall Progress</th><td>{eff}%</td><th>Projected Completion</th><td>{fmtDate(project.due)}</td></tr>
        </tbody>
      </table>

      <h2 className="report-h2">Project Status This Period</h2>
      <div className="report-status-row">
        <span className="report-badge" style={{ background: status.color }}>{status.label.toUpperCase()}</span>
      </div>
      <div className="report-summary">
        <div className="report-summary-label">Summary</div>
        <div>
          <p>{autoSummary}</p>
          {updates.map(n => <p key={n.id}>• {n.text}</p>)}
        </div>
      </div>

      <h2 className="report-h2">Tasks</h2>
      <table className="report-table">
        <thead><tr><th>Task</th><th>Status</th><th>Assignees</th><th>Est. Hours</th><th>Logged Hours</th><th>Progress</th></tr></thead>
        <tbody>
          {shownTasks.length === 0 && <tr><td colSpan="6" className="report-empty">No tasks.</td></tr>}
          {shownTasks.map(t => (
            <tr key={t.id}>
              <td>{t.title}</td><td>{columnOf(t)}</td>
              <td>{(t.assignees || []).join(", ") || "—"}</td>
              <td>{t.hours || 0}h</td>
              <td>{(taskHours[t.id] || 0)}h</td>
              <td>{t.progress}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="report-h2">Risks &amp; Roadblocks</h2>
      {roadblocks.map(n => <p key={n.id} className="report-note">• {n.text}</p>)}
      <table className="report-table">
        <thead><tr><th>Blocked task</th><th>Project</th><th>Assignees</th></tr></thead>
        <tbody>
          {blocked === 0 && roadblocks.length === 0 && <tr><td colSpan="3" className="report-empty">No roadblocks noted.</td></tr>}
          {tasks.filter(t => t.blocked).map(t => (
            <tr key={t.id}><td>{t.title}</td><td>{t.project}</td><td>{(t.assignees || []).join(", ") || "—"}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="report-h2">Decisions Needed</h2>
      <table className="report-table">
        <thead><tr><th>Owner / Requester</th><th>Decision</th><th>Deadline</th><th>Status</th></tr></thead>
        <tbody>
          {decisions.length === 0 && <tr><td colSpan="4" className="report-empty">None.</td></tr>}
          {decisions.map(d => (
            <tr key={d.id}><td>{d.owner || "—"}</td><td>{d.description}</td><td>{d.deadline ? fmtDate(d.deadline) : "—"}</td><td>{d.status}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="report-h2">Milestones</h2>
      <table className="report-table">
        <thead><tr><th></th><th>Milestone</th><th>Detail</th><th>Due</th></tr></thead>
        <tbody>
          {milestones.length === 0 && <tr><td colSpan="4" className="report-empty">No milestones yet.</td></tr>}
          {milestones.map(m => (
            <tr key={m.id}><td>{m.done ? "✓" : "○"}</td><td>{m.title}</td><td>{m.detail || "—"}</td><td>{m.due ? fmtDate(m.due) : "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
