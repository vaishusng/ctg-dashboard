import { useState, useRef } from "react";
import ProjectReport from "./ProjectReport.jsx";
import MultiSelect from "./MultiSelect.jsx";
import { effectiveProgress, fmtDate } from "./data.js";

const money = (n) => Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });

// ---------------------------------------------------------------------------
// Project Report page. Owners get an OfficeTimer-style Search Parameters panel
// and ONE combined report: a single cost table across the selected projects,
// plus full status sections when exactly one project is chosen. One toolbar
// exports the whole thing (every selected project), not just the first.
// ---------------------------------------------------------------------------
export default function ReportsPage({
  projects = [], tasks = [], people = [], milestones = [], decisions = [], projectNotes = [],
  taskHours = {},
  isAdmin = false, budgetOf = () => 0, budgetStatus = () => null, projectEntries = () => [],
  hoursEntries = [],
}) {
  const reportRef = useRef(null);

  const statusProps = (p) => ({
    project: p,
    tasks: tasks.filter(t => t.project === p.name && !t.archived),
    people,
    milestones: milestones.filter(m => m.project_id === p.id).sort((a, b) => ((a.due || "9999") < (b.due || "9999") ? -1 : 1)),
    decisions: decisions.filter(d => d.project_id === p.id),
    projectNotes: projectNotes.filter(n => n.project_id === p.id),
    eff: effectiveProgress(p, tasks),
    taskHours,
  });

  // option lists
  const allEmps = [];
  {
    const s = {};
    if (isAdmin) {
      projects.forEach(p => projectEntries(p.id).forEach(e => { if (!s[e.user_id]) { s[e.user_id] = 1; allEmps.push({ user_id: e.user_id, name: e.name }); } }));
    } else {
      people.forEach(p => { if (p.id && !s[p.id]) { s[p.id] = 1; allEmps.push({ user_id: p.id, name: p.name }); } });
    }
  }
  const allClients = [...new Set(projects.map(p => p.client).filter(Boolean))];

  const [pickId, setPickId] = useState(projects[0] ? projects[0].id : null);
  const [selEmps, setSelEmps] = useState(allEmps.map(e => e.user_id));
  const [selClients, setSelClients] = useState(allClients);
  const [selProjects, setSelProjects] = useState(projects[0] ? [projects[0].id] : []);
  const [selTasks, setSelTasks] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timesheetType, setTimesheetType] = useState("Both");
  const [reportType, setReportType] = useState("Consolidated");
  const [applied, setApplied] = useState({
    emps: allEmps.map(e => e.user_id), clients: allClients, projects: projects[0] ? [projects[0].id] : [],
    tasks: null, start: "", end: "", timesheet: "Both", type: "Consolidated",
  });
  const showReport = () => setApplied({
    emps: selEmps, clients: selClients, projects: selProjects, tasks: selTasks,
    start: startDate, end: endDate, timesheet: timesheetType, type: reportType,
  });

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
    a.download = "CTG_Project_Report.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (projects.length === 0) {
    return (
      <main className="page">
        <h1 className="page-title">Project Report</h1>
        <p className="pd-muted">No projects yet. Create a project first, then come back to generate its report.</p>
      </main>
    );
  }

  const selProjectNames = projects.filter(p => selProjects.includes(p.id)).map(p => p.name);
  const taskOptions = tasks.filter(t => selProjectNames.includes(t.project)).map(t => ({ value: t.id, label: t.title }));

  // ---------- ONE REPORT FOR EVERYONE (Budget & Labor gated below) ----------
  const shownProjects = projects.filter(p => applied.projects.includes(p.id) && applied.clients.includes(p.client));

  // combined cost rows across the selected projects
  let rows = [];
  if (applied.timesheet !== "Time Off Records") {
    shownProjects.forEach(p => projectEntries(p.id).forEach(e => rows.push({ ...e, projectName: p.name })));
    rows = rows.filter(e =>
      applied.emps.includes(e.user_id) &&
      (!applied.start || (e.date && e.date >= applied.start)) &&
      (!applied.end || (e.date && e.date <= applied.end))
    );
  }
  const consolidated = (() => {
    const by = {};
    rows.forEach(e => {
      const k = e.projectName + "||" + e.user_id + "||" + e.rate;
      if (!by[k]) by[k] = { key: k, projectName: e.projectName, name: e.name, rate: e.rate, hours: 0, cost: 0 };
      by[k].hours += e.hours;
      by[k].cost += e.amount;
    });
    return Object.values(by).sort((a, b) =>
      a.projectName !== b.projectName ? (a.projectName < b.projectName ? -1 : 1)
      : a.name !== b.name ? (a.name < b.name ? -1 : 1)
      : b.rate - a.rate
    );
  })();
  const totalHours = rows.reduce((s, e) => s + e.hours, 0);
  const totalCost = rows.reduce((s, e) => s + e.amount, 0);

  const totalBudget = shownProjects.reduce((s, p) => s + budgetOf(p.id), 0);
  const fullCost = shownProjects.reduce((s, p) => { const bs = budgetStatus(p.id); return s + (bs ? bs.cost : 0); }, 0);
  const variance = totalBudget - fullCost;
  let bStatus = { label: "No budget set", color: "#94a3b8" };
  if (totalBudget > 0) {
    if (variance < 0) bStatus = { label: "Over budget", color: "#dc2626" };
    else if (variance <= 0.05 * totalBudget) bStatus = { label: "On budget", color: "#f59e0b" };
    else bStatus = { label: "Under budget", color: "#16a34a" };
  }

  const single = shownProjects.length === 1 ? shownProjects[0] : null;

  // ----- Non-admin Consolidated: project / employee / hours (no money) -----
  const nameById = {};
  allEmps.forEach(e => { nameById[e.user_id] = e.name; });
  let hourRows = [];
  if (!isAdmin && applied.timesheet !== "Time Off Records") {
    shownProjects.forEach(p => hoursEntries.filter(h => h.project_id === p.id).forEach(h => hourRows.push({ ...h, projectName: p.name })));
    hourRows = hourRows.filter(h =>
      applied.emps.includes(h.user_id) &&
      (!applied.start || (h.date && h.date >= applied.start)) &&
      (!applied.end || (h.date && h.date <= applied.end))
    );
  }
  const hoursConsolidated = (() => {
    const by = {};
    hourRows.forEach(h => {
      const k = h.projectName + "||" + h.user_id;
      if (!by[k]) by[k] = { key: k, projectName: h.projectName, name: nameById[h.user_id] || "(member)", hours: 0 };
      by[k].hours += h.hours;
    });
    return Object.values(by).sort((a, b) =>
      a.projectName !== b.projectName ? (a.projectName < b.projectName ? -1 : 1) : (a.name < b.name ? -1 : 1)
    );
  })();
  const hoursTotal = hourRows.reduce((s, h) => s + h.hours, 0);

  return (
    <main className="page">
      <h1 className="page-title">Project Report</h1>

      <div className="report-params">
        <div className="report-params-head">Search Parameters</div>
        <div className="report-params-body">
          <div className="rp-row">
            <span className="rp-label">Employees</span>
            <MultiSelect options={allEmps.map(e => ({ value: e.user_id, label: e.name }))}
              selected={selEmps} onChange={setSelEmps} allLabel="< All >" placeholder="None selected" />
          </div>
          <div className="rp-row">
            <span className="rp-label">Clients</span>
            <MultiSelect options={allClients.map(c => ({ value: c, label: c }))}
              selected={selClients} onChange={setSelClients} allLabel="< All >" placeholder="None selected" />
          </div>
          <div className="rp-row">
            <span className="rp-label">Projects</span>
            <MultiSelect options={projects.map(p => ({ value: p.id, label: p.name }))}
              selected={selProjects} onChange={(sel) => { setSelProjects(sel); setSelTasks(null); }}
              allLabel="< All >" placeholder="None selected" />
          </div>
          <div className="rp-row">
            <span className="rp-label">Project Tasks</span>
            <MultiSelect options={taskOptions}
              selected={selTasks === null ? taskOptions.map(o => o.value) : selTasks}
              onChange={setSelTasks} allLabel="< All >" placeholder="None selected" />
          </div>
          <div className="rp-row">
            <span className="rp-label">Start date</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="rp-row">
            <span className="rp-label">End date</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="rp-row">
            <span className="rp-label">Timesheet type</span>
            {["Both", "Timesheet Records", "Time Off Records"].map(t => (
              <label key={t} className="check">
                <input type="radio" name="ttype" checked={timesheetType === t} onChange={() => setTimesheetType(t)} /> {t}
              </label>
            ))}
          </div>
          <div className="rp-row">
            <span className="rp-label">Report type</span>
            {["Consolidated", "Detailed"].map(t => (
              <label key={t} className="check">
                <input type="radio" name="rtype" checked={reportType === t} onChange={() => setReportType(t)} /> {t}
              </label>
            ))}
          </div>
          <button className="btn btn-primary" onClick={showReport}>Show</button>
        </div>
      </div>

      <div className="report-wrap">
        <div className="report-toolbar no-print">
          <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
          <button className="btn" onClick={downloadWord}>⬇ Download as Word</button>
          <span className="pd-muted">For PDF: use Print → "Save as PDF".</span>
        </div>

        <div className="report" ref={reportRef}>
          <h1 className="report-title">
            {isAdmin ? "Project Cost & Revenue Report" : (applied.type === "Detailed" ? "Project Status Report" : "Project Hours Report")}
          </h1>

          {isAdmin && (
          <>
          <h2 className="report-h2">Budget &amp; Labor (owners only)</h2>
          {applied.type === "Detailed" ? (
            <div style={{ overflowX: "auto" }}>
            <table className="report-table">
              <thead><tr>
                <th>Project Name</th><th>Task Name</th><th>Employee Name</th><th>Date</th>
                <th>Description</th><th>Hours</th><th>Task Estimated Hours</th><th>Cost Center</th>
                <th>Billing Rate</th><th>Amount</th><th>Task Estimated Cost</th><th>Task Work Order Value</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan="12" className="report-empty">No entries match the selected filters.</td></tr>}
                {rows.map((e, i) => (
                  <tr key={i}>
                    <td>{e.projectName}</td>
                    <td>{e.task || "—"}</td>
                    <td>{e.name}</td>
                    <td>{e.date ? fmtDate(e.date) : "—"}</td>
                    <td>{e.note || "—"}</td>
                    <td>{e.hours}</td>
                    <td>{e.task ? `${e.taskEst}h` : "—"}</td>
                    <td>—</td>
                    <td>{money(e.rate)}</td>
                    <td>{money(e.amount)}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr>
                    <th>Total</th><th></th><th></th><th></th><th></th>
                    <th>{totalHours}</th><th></th><th></th><th></th>
                    <th>{money(totalCost)}</th><th></th><th></th>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          ) : (
            <table className="report-table">
              <thead><tr><th>Project</th><th>Employee</th><th>Hours</th><th>Rate ($/hr)</th><th>Cost</th></tr></thead>
              <tbody>
                {consolidated.length === 0 && <tr><td colSpan="5" className="report-empty">No entries match the selected filters.</td></tr>}
                {consolidated.map(r => (
                  <tr key={r.key}><td>{r.projectName}</td><td>{r.name}</td><td>{r.hours}</td><td>{money(r.rate)}</td><td>{money(r.cost)}</td></tr>
                ))}
                {consolidated.length > 0 && (
                  <tr><th>Total</th><th></th><th>{totalHours}</th><th></th><th>{money(totalCost)}</th></tr>
                )}
              </tbody>
            </table>
          )}

          <table className="report-table">
            <tbody>
              <tr><th>Budget {single ? "" : "(selected projects)"}</th><td>{money(totalBudget)}</td></tr>
              <tr><th>Labor cost to date</th><td>{money(fullCost)}</td></tr>
              <tr><th>Variance (budget − cost)</th><td>{money(variance)}</td></tr>
              <tr><th>Budget status</th><td><span className="report-badge" style={{ background: bStatus.color }}>{bStatus.label.toUpperCase()}</span></td></tr>
            </tbody>
          </table>
          </>
          )}

          {/* Non-admin Consolidated: project / employee / hours, no money */}
          {!isAdmin && applied.type === "Consolidated" && (
            <table className="report-table">
              <thead><tr><th>Project</th><th>Employee</th><th>Hours</th></tr></thead>
              <tbody>
                {hoursConsolidated.length === 0 && <tr><td colSpan="3" className="report-empty">No hours match the selected filters.</td></tr>}
                {hoursConsolidated.map(r => (
                  <tr key={r.key}><td>{r.projectName}</td><td>{r.name}</td><td>{r.hours}</td></tr>
                ))}
                {hoursConsolidated.length > 0 && (
                  <tr><th>Total</th><th></th><th>{hoursTotal}</th></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Status report: Detailed view only, one project at a time */}
          {applied.type === "Detailed" && single && (
            <>
              {isAdmin && <h1 className="report-title" style={{ pageBreakBefore: "always" }}>Project Status Report</h1>}
              <ProjectReport {...statusProps(single)} fTasks={applied.tasks} />
            </>
          )}
          {applied.type === "Detailed" && !single && (
            <p className="pd-muted">Select a single project in the Projects filter, then click Show, to view its status report.</p>
          )}
        </div>
      </div>
    </main>
  );
}
