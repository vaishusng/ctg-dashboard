import { useRef } from "react";
import { fmtDate, columnOf, trackStatus } from "./data.js";

// ---------------------------------------------------------------------------
// Project Status Report (modeled on the Smartsheet status-report template).
// The "summary" is generated from the project's real data — no AI needed.
// Export options:
//   • Print / Save as PDF  (browser print dialog)
//   • Download as Word     (.doc file Word opens cleanly — tables, headings)
// ---------------------------------------------------------------------------

function todayStr() {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function ProjectReport({ project, tasks, people, milestones, decisions, projectNotes = [], eff }) {
  const reportRef = useRef(null);

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

  function downloadWord() {
    const inner = reportRef.current ? reportRef.current.innerHTML : "";
    const html =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
      `<head><meta charset="utf-8"><style>` +
      `body{font-family:Calibri,Arial,sans-serif;color:#0f172a;} h1{font-size:22pt;} h2{font-size:13pt;border-bottom:1.5px solid #0f172a;padding-bottom:3px;}` +
      `table{border-collapse:collapse;width:100%;margin:6px 0;} th,td{border:1px solid #94a3b8;padding:5px 8px;text-align:left;font-size:10.5pt;} th{background:#eef2f7;}` +
      `.report-badge{padding:4px 12px;color:#fff;font-weight:bold;}` +
      `</style></head><body>${inner}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/[^a-z0-9]+/gi, "_")}_Status_Report.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="report-wrap">
      <div className="report-toolbar no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        <button className="btn" onClick={downloadWord}>⬇ Download as Word</button>
        <span className="pd-muted">For PDF: use Print → "Save as PDF".</span>
      </div>

      <div className="report" ref={reportRef}>
        <h1 className="report-title">Project Status Report</h1>

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
          <thead><tr><th>Task</th><th>Status</th><th>Assignees</th><th>Hours</th><th>Progress</th></tr></thead>
          <tbody>
            {tasks.length === 0 && <tr><td colSpan="5" className="report-empty">No tasks.</td></tr>}
            {tasks.map(t => (
              <tr key={t.id}>
                <td>{t.title}</td><td>{columnOf(t)}</td>
                <td>{(t.assignees || []).join(", ") || "—"}</td><td>{t.hours || 0}h</td><td>{t.progress}%</td>
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
      </div>
    </div>
  );
}
