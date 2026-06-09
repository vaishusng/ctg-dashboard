import { useMemo, useRef, useState } from "react";
import TaskCard from "./TaskCard.jsx";
import TaskModal from "./TaskModal.jsx";
import {
  COLUMNS, COLUMN_COLOR, STAGES, PRIORITIES, PRIORITY_RANK, columnOf,
} from "./data.js";

// ---------------------------------------------------------------------------
// Screen 2 — the board.
// - New tasks must use an ESTABLISHED project + client (dropdowns; no typos).
// - Select mode: pick several tasks, then Complete / Block / Archive / Trash
//   them all at once.
// - Completed tasks can be archived (📦): hidden from the board, kept in the
//   Archive section below, still counted in project progress.
// ---------------------------------------------------------------------------

export default function Board({ tasks, trash, people, projects, onOpen, onDrop, onAdd, onStar, onTrash, onRecover, onPurge, onBulk, onUnarchive }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("Priority");
  const [sortDir, setSortDir] = useState("High to Low");
  const [filterOpen, setFilterOpen] = useState(false);
  const [excluded, setExcluded] = useState({ projects: [], stages: [], assignees: [] });
  const [addOpen, setAddOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const draggedId = useRef(null);

  // ---- select mode (main board) ----
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

  // ---- select mode (archive + trash sections) ----
  const [archMode, setArchMode] = useState(false);
  const [archSel, setArchSel] = useState([]);
  const [trashMode, setTrashMode] = useState(false);
  const [trashSel, setTrashSel] = useState([]);
  const toggleArch = (id) => setArchSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleTrash = (id) => setTrashSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const active = tasks.filter(t => !t.archived);
  const archived = tasks.filter(t => t.archived);

  const boardProjects = useMemo(() => [...new Set(active.map(t => t.project))].sort(), [active]);

  function toggleExcluded(group, value) {
    setExcluded(prev => {
      const list = prev[group];
      return {
        ...prev,
        [group]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
      };
    });
  }

  const activeFilters =
    excluded.projects.length + excluded.stages.length + excluded.assignees.length;

  function passes(t) {
    if (excluded.projects.includes(t.project)) return false;
    if (excluded.stages.includes(t.stage)) return false;
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

  const visible = active.filter(passes);

  return (
    <main className="page">
      <div className="eyebrow">CATALYST TECHNICAL GROUP</div>
      <h1 className="page-title">Task Dashboard</h1>

      {/* ---- controls row ---- */}
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
                <div className="filter-title">Projects</div>
                {boardProjects.map(p => (
                  <label key={p} className="check">
                    <input type="checkbox" checked={!excluded.projects.includes(p)}
                      onChange={() => toggleExcluded("projects", p)} /> {p}
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
          placeholder="🔍  Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button
          className={selectMode ? "btn btn-primary" : "btn"}
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
        >
          ☑ Select
        </button>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>＋ New task</button>
      </div>

      {/* ---- bulk action bar (select mode) ---- */}
      {selectMode && (
        <div className="bulk-bar">
          <span className="bulk-count mono">{selected.length} selected</span>
          <span className="bulk-hint">Click cards to select them, then:</span>
          <button className="btn" onClick={() => setSelected(visible.map(t => t.id))}>Select all</button>
          <button className="btn" disabled={!selected.length} onClick={() => setSelected([])}>Clear</button>
          <button className="btn" disabled={!selected.length} onClick={() => runBulk("complete")}>✓ Complete</button>
          <button className="btn" disabled={!selected.length} onClick={() => runBulk("block")}>⛔ Block</button>
          <button className="btn" disabled={!selected.length} onClick={() => runBulk("unblock")}>Unblock</button>
          <button className="btn" disabled={!selected.length} onClick={() => runBulk("archive")}>📦 Archive</button>
          <button className="btn btn-danger" disabled={!selected.length} onClick={() => runBulk("trash")}>🗑 Trash</button>
          <button className="btn" onClick={exitSelect}>Cancel</button>
        </div>
      )}

      {/* ---- the four columns ---- */}
      <div className="board">
        {COLUMNS.map(col => {
          const colTasks = visible.filter(t => columnOf(t) === col).sort(compare);
          return (
            <section
              key={col}
              className={"col" + (dragOverCol === col ? " col-over" : "")}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => {
                if (draggedId.current != null) onDrop(draggedId.current, col);
                draggedId.current = null;
                setDragOverCol(null);
              }}
            >
              <header className="col-head">
                <span className="col-dot" style={{ background: COLUMN_COLOR[col] }} />
                <span className="col-name">{col}</span>
                <span className="col-count mono">{colTasks.length}</span>
                {col === "Completed" && colTasks.length > 0 && !selectMode && (
                  <button
                    className="col-archive-all"
                    title="Archive every completed task"
                    onClick={() => onBulk(colTasks.map(t => t.id), "archive")}
                  >📦 all</button>
                )}
              </header>

              {colTasks.length === 0 && <div className="col-empty">No tasks</div>}

              {colTasks.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  people={people}
                  projects={projects}
                  selectMode={selectMode}
                  selected={selected.includes(t.id)}
                  onOpen={() => (selectMode ? toggleSelected(t.id) : onOpen(t.id))}
                  onDragStart={() => { draggedId.current = t.id; }}
                  onDragEnd={() => { draggedId.current = null; setDragOverCol(null); }}
                  onStar={() => onStar(t.id)}
                  onArchive={() => onBulk([t.id], "archive")}
                  onTrash={() => onTrash(t.id)}
                />
              ))}
            </section>
          );
        })}
      </div>

      {/* ---- archive ---- */}
      <section className="trash">
        <button className="trash-toggle" onClick={() => setArchiveOpen(o => !o)}>
          📦 Archive ({archived.length}) {archiveOpen ? "▾" : "▸"}
        </button>
        {archiveOpen && (
          <div className="trash-list">
            {archived.length === 0 && (
              <div className="col-empty">Nothing archived yet — finish a task and hit 📦 to file it here.</div>
            )}
            {archived.length > 0 && (
              <div className="bulk-bar">
                <button className={archMode ? "btn btn-primary" : "btn"}
                  onClick={() => { setArchMode(m => !m); setArchSel([]); }}>☑ Select</button>
                {archMode && <>
                  <span className="bulk-count mono">{archSel.length} selected</span>
                  <button className="btn" onClick={() => setArchSel(archived.map(t => t.id))}>Select all</button>
                  <button className="btn" disabled={!archSel.length} onClick={() => setArchSel([])}>Clear</button>
                  <button className="btn" disabled={!archSel.length}
                    onClick={() => { onBulk(archSel, "unarchive"); setArchSel([]); }}>Unarchive</button>
                  <button className="btn btn-danger" disabled={!archSel.length}
                    onClick={() => { onBulk(archSel, "trash"); setArchSel([]); }}>🗑 Trash</button>
                </>}
              </div>
            )}
            {archived.map(t => (
              <div key={t.id}
                className={"trash-row" + (archMode ? " trash-row-selectable" : "") + (archSel.includes(t.id) ? " trash-row-selected" : "")}
                onClick={archMode ? () => toggleArch(t.id) : undefined}>
                <div>
                  {archMode && <span className={"card-checkbox" + (archSel.includes(t.id) ? " on" : "")}>{archSel.includes(t.id) ? "✓" : ""}</span>}
                  <span className="mono trash-id">TK:{t.id}</span> {t.title}
                  <span className="trash-proj"> — {t.project}</span>
                </div>
                {!archMode && (
                  <div className="trash-actions">
                    <button className="btn" onClick={() => onUnarchive(t.id)}>Unarchive</button>
                    <button className="btn btn-danger" onClick={() => onTrash(t.id)}>🗑 Trash</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- trash ---- */}
      <section className="trash">
        <button className="trash-toggle" onClick={() => setTrashOpen(o => !o)}>
          🗑 Trash ({trash.length}) {trashOpen ? "▾" : "▸"}
        </button>
        {trashOpen && (
          <div className="trash-list">
            {trash.length === 0 && <div className="col-empty">Trash is empty.</div>}
            {trash.length > 0 && (
              <div className="bulk-bar">
                <button className={trashMode ? "btn btn-primary" : "btn"}
                  onClick={() => { setTrashMode(m => !m); setTrashSel([]); }}>☑ Select</button>
                {trashMode && <>
                  <span className="bulk-count mono">{trashSel.length} selected</span>
                  <button className="btn" onClick={() => setTrashSel(trash.map(t => t.id))}>Select all</button>
                  <button className="btn" disabled={!trashSel.length} onClick={() => setTrashSel([])}>Clear</button>
                  <button className="btn" disabled={!trashSel.length}
                    onClick={() => { onBulk(trashSel, "recover"); setTrashSel([]); }}>Recover</button>
                  <button className="btn btn-danger" disabled={!trashSel.length}
                    onClick={() => { onBulk(trashSel, "purge"); setTrashSel([]); }}>Delete forever</button>
                </>}
              </div>
            )}
            {trash.map(t => (
              <div key={t.id}
                className={"trash-row" + (trashMode ? " trash-row-selectable" : "") + (trashSel.includes(t.id) ? " trash-row-selected" : "")}
                onClick={trashMode ? () => toggleTrash(t.id) : undefined}>
                <div>
                  {trashMode && <span className={"card-checkbox" + (trashSel.includes(t.id) ? " on" : "")}>{trashSel.includes(t.id) ? "✓" : ""}</span>}
                  <span className="mono trash-id">TK:{t.id}</span> {t.title}
                  <span className="trash-proj"> — {t.project}</span>
                </div>
                {!trashMode && (
                  <div className="trash-actions">
                    <button className="btn" onClick={() => onRecover(t.id)}>Recover</button>
                    <button className="btn btn-danger" onClick={() => onPurge(t.id)}>Delete forever</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {addOpen && (
        <TaskModal
          people={people}
          projects={projects}
          onAdd={onAdd}
          onClose={() => setAddOpen(false)}
        />
      )}
    </main>
  );
}
