import { useMemo, useState } from "react";
import ProjectModal from "./ProjectModal.jsx";
import { fmtDate, effectiveProgress } from "./data.js";

// ---------------------------------------------------------------------------
// Project Dashboard. Filter by client AND by Done / Not done.
// Select mode: pick several projects, then mark them Done or Archive them.
// Projects use one set-aside flag (trashed in the DB), shown here as "Archive":
// archived projects can be unarchived or deleted permanently.
// ---------------------------------------------------------------------------

export default function ProjectsPage({ projects, tasks, trash, people = [], onOpen, onAdd, onUpdate, onStar, onTrash, onRecover, onPurge, onBulk, isAdmin = false, budgets = [] }) {
  const budgetOf = (id) => { const b = budgets.find(x => x.project_id === id); return b ? Number(b.amount) : 0; };
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("Delivery date");
  const [sortDir, setSortDir] = useState("High to Low");
  const [filterOpen, setFilterOpen] = useState(false);
  const [excludedClients, setExcludedClients] = useState([]);
  const [excludedStatus, setExcludedStatus] = useState([]); // "Done" | "Not done"
  const [starredOnly, setStarredOnly] = useState(false);
  const [modal, setModal] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);

  // ---- select mode ----
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  function toggleSelected(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function exitSelect() { setSelectMode(false); setSelected([]); }
  function runBulk(action) {
    if (selected.length) onBulk(selected, action);
    exitSelect();
  }

  // ---- trash select mode ----
  const [trashMode, setTrashMode] = useState(false);
  const [trashSel, setTrashSel] = useState([]);
  const toggleTrash = (id) => setTrashSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const clients = useMemo(
    () => [...new Set(projects.map(p => p.client))].sort(),
    [projects]
  );

  function toggleClient(c) {
    setExcludedClients(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }
  function toggleStatus(s) {
    setExcludedStatus(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }
  const activeFilters = excludedClients.length + excludedStatus.length + (starredOnly ? 1 : 0);

  function passes(p) {
    const status = effectiveProgress(p, tasks) >= 100 ? "Done" : "Not done";
    if (excludedStatus.includes(status)) return false;
    if (excludedClients.includes(p.client)) return false;
    if (starredOnly && !p.starred) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.client.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function sortKey(p) {
    if (sortField === "Delivery date") return p.due || "9999-12-31";
    if (sortField === "Progress") return effectiveProgress(p, tasks);
    return p.name.toLowerCase();
  }
  function compare(a, b) {
    const ka = sortKey(a), kb = sortKey(b);
    const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
    return sortDir === "High to Low" ? -cmp : cmp;
  }

  const visible = projects.filter(passes).sort(compare);

  return (
    <main className="page">
      <div className="eyebrow">CATALYST TECHNICAL GROUP</div>
      <h1 className="page-title">Project Dashboard</h1>

      {/* ---- controls ---- */}
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
                {["Done", "Not done"].map(s => (
                  <label key={s} className="check">
                    <input type="checkbox" checked={!excludedStatus.includes(s)}
                      onChange={() => toggleStatus(s)} /> {s}
                  </label>
                ))}
              </div>
              <div className="filter-group">
                <div className="filter-title">Starred</div>
                <label className="check">
                  <input type="checkbox" checked={starredOnly}
                    onChange={() => setStarredOnly(v => !v)} /> Starred only
                </label>
              </div>
              <div className="filter-group">
                <div className="filter-title">Clients</div>
                {clients.map(c => (
                  <label key={c} className="check">
                    <input type="checkbox" checked={!excludedClients.includes(c)}
                      onChange={() => toggleClient(c)} /> {c}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <label className="control">
          <span>Sort by</span>
          <select value={sortField} onChange={e => setSortField(e.target.value)}>
            <option>Delivery date</option><option>Progress</option><option>Name</option>
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
          placeholder="🔍  Search projects or clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button
          className={selectMode ? "btn btn-primary" : "btn"}
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
        >
          ☑ Select
        </button>
        <button className="btn btn-primary" onClick={() => setModal("new")}>＋ New project</button>
      </div>

      {/* ---- bulk action bar ---- */}
      {selectMode && (
        <div className="bulk-bar">
          <span className="bulk-count mono">{selected.length} selected</span>
          <span className="bulk-hint">Click projects to select them, then:</span>
          <button className="btn" onClick={() => setSelected(visible.map(p => p.id))}>Select all</button>
          <button className="btn" disabled={!selected.length} onClick={() => setSelected([])}>Clear</button>
          <button className="btn" disabled={!selected.length} onClick={() => runBulk("done")}>✓ Mark done</button>
          <button className="btn" disabled={!selected.length} onClick={() => runBulk("trash")}>📦 Archive</button>
          <button className="btn" onClick={exitSelect}>Cancel</button>
        </div>
      )}

      {/* ---- two loose columns of big cards ---- */}
      <div className="proj-grid">
        {visible.length === 0 && <div className="col-empty">No projects match.</div>}
        {visible.map(p => {
          const eff = effectiveProgress(p, tasks);
          const isSelected = selected.includes(p.id);
          return (
            <article
              key={p.id}
              className={"proj-card" + (isSelected ? " card-selected" : "") + (selectMode ? " card-selectable" : "")}
              style={{ borderTop: `4px solid ${p.color || "#64748b"}` }}
              onClick={() => (selectMode ? toggleSelected(p.id) : onOpen(p.id))}
            >
              {selectMode && (
                <span className={"card-checkbox" + (isSelected ? " on" : "")}>{isSelected ? "✓" : ""}</span>
              )}
              <div className="proj-top">
                <h2 className="proj-name">{p.starred ? "★ " : ""}{p.name}</h2>
                {eff >= 100 && <span className="proj-done mono">DONE</span>}
              </div>
              <div className="proj-meta">
                <span className="detail-clientbox proj-client">{p.client}</span>
                <span className="proj-due mono">📅 {fmtDate(p.due)}</span>
              </div>
              <p className="proj-desc">{p.description}</p>
              <div className="proj-progrow">
                <div className="bar-bg bar-bg-lg">
                  <div className="bar" style={{ width: `${eff}%`, background: p.color || "#64748b" }} />
                </div>
                <span className="mono detail-pct">{eff}%</span>
                {p.auto && <span className="auto-badge mono" title="Hours-weighted average of this project's tasks">AUTO</span>}
              </div>
              {!selectMode && (
                <div className="proj-actions">
                  <button
                    className={"proj-iconbtn" + (p.starred ? " star-on" : "")}
                    title={p.starred ? "Unstar project" : "Star project"}
                    onClick={e => { e.stopPropagation(); onStar(p.id); }}
                  >{p.starred ? "★" : "☆"}</button>
                  <button
                    className="proj-iconbtn"
                    title="Edit project"
                    onClick={e => { e.stopPropagation(); setModal(p); }}
                  >✎</button>
                  <button
                    className="proj-iconbtn"
                    title="Archive"
                    onClick={e => { e.stopPropagation(); onTrash(p.id); }}
                  >📦</button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* ---- archive ---- */}
      <section className="trash">
        <button className="trash-toggle" onClick={() => setTrashOpen(o => !o)}>
          📦 Archive ({trash.length}) {trashOpen ? "▾" : "▸"}
        </button>
        {trashOpen && (
          <div className="trash-list">
            {trash.length === 0 && <div className="col-empty">Nothing archived yet.</div>}
            {trash.length > 0 && (
              <div className="bulk-bar">
                <button className={trashMode ? "btn btn-primary" : "btn"}
                  onClick={() => { setTrashMode(m => !m); setTrashSel([]); }}>☑ Select</button>
                {trashMode && <>
                  <span className="bulk-count mono">{trashSel.length} selected</span>
                  <button className="btn" onClick={() => setTrashSel(trash.map(p => p.id))}>Select all</button>
                  <button className="btn" disabled={!trashSel.length} onClick={() => setTrashSel([])}>Clear</button>
                  <button className="btn" disabled={!trashSel.length}
                    onClick={() => { onBulk(trashSel, "recover"); setTrashSel([]); }}>Unarchive</button>
                  <button className="btn btn-danger" disabled={!trashSel.length}
                    onClick={() => { if (window.confirm(`Delete ${trashSel.length} project(s) permanently? This cannot be undone.`)) { onBulk(trashSel, "purge"); setTrashSel([]); } }}>Delete permanently</button>
                </>}
              </div>
            )}
            {trash.map(p => (
              <div key={p.id}
                className={"trash-row" + (trashMode ? " trash-row-selectable" : "") + (trashSel.includes(p.id) ? " trash-row-selected" : "")}
                onClick={trashMode ? () => toggleTrash(p.id) : undefined}>
                <div>
                  {trashMode && <span className={"card-checkbox" + (trashSel.includes(p.id) ? " on" : "")}>{trashSel.includes(p.id) ? "✓" : ""}</span>}
                  <b>{p.name}</b>
                  <span className="trash-proj"> — {p.client}</span>
                </div>
                {!trashMode && (
                  <div className="trash-actions">
                    <button className="btn" onClick={() => onRecover(p.id)}>Unarchive</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm("Delete this project permanently? This cannot be undone.")) onPurge(p.id); }}>Delete permanently</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {modal !== null && (
        <ProjectModal
          initial={modal === "new" ? null : modal}
          people={people}
          autoValue={modal === "new" ? null : effectiveProgress({ ...modal, auto: true }, tasks)}
          isAdmin={isAdmin}
          initialBudget={modal === "new" ? 0 : budgetOf(modal.id)}
          onClose={() => setModal(null)}
          onSave={(clean) => (modal === "new" ? onAdd(clean) : onUpdate(clean))}
        />
      )}
    </main>
  );
}
