import { useRef } from "react";
import { PRIORITY_COLOR, colorOf, projectColor, trackStatus } from "./data.js";

// ---------------------------------------------------------------------------
// One task card. Click to open (or to select, in Select mode), drag to move,
// ☆ to star, 📦 to archive (file it away; delete permanently from the Archive).
// Its color comes from its PROJECT.
// ---------------------------------------------------------------------------

export default function TaskCard({ task, people, projects, selectMode, selected, onOpen, onDragStart, onDragEnd, onStar, onArchive }) {
  const didDrag = useRef(false);
  const accent = projectColor(projects, task.project);
  const track = trackStatus(task);
  const isCompleted = task.progress >= 100 && !task.blocked;

  return (
    <article
      className={"card" + (selected ? " card-selected" : "") + (selectMode ? " card-selectable" : "")}
      draggable={!selectMode}
      style={{ borderLeft: `4px solid ${accent}` }}
      onDragStart={e => {
        didDrag.current = true;
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => {
        onDragEnd();
        setTimeout(() => { didDrag.current = false; }, 0);
      }}
      onClick={() => { if (!didDrag.current) onOpen(); }}
    >
      {selectMode && (
        <span className={"card-checkbox" + (selected ? " on" : "")}>{selected ? "✓" : ""}</span>
      )}

      <div className="card-title">{task.title}</div>

      <div className="card-tags">
        <span className="mono card-id">TK:{task.id}</span>
        <span className="card-stage">{task.stage}</span>
      </div>

      <div className="card-proj" style={{ color: accent, fontWeight: 600 }}>{task.project}</div>

      <div className="bar-bg">
        <div className="bar" style={{ width: `${task.progress}%`, background: track ? track.color : accent }} />
      </div>

      <div className="card-meta">
        <span className="mono card-hours">
          🕐 {task.hours}h
          <span className="dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
        </span>
        <span className="avatars">
          {task.assignees.map(a => (
            <span key={a} className="avatar" style={{ background: colorOf(people, a) }}>
              {a}
            </span>
          ))}
        </span>
      </div>

      {!selectMode && (
        <div className="card-actions">
          <button
            className={"card-iconbtn" + (task.starred ? " star-on" : "")}
            title={task.starred ? "Unstar task" : "Star task"}
            onClick={e => { e.stopPropagation(); onStar(); }}
          >{task.starred ? "★" : "☆"}</button>
          {onArchive && (
            <button
              className="card-iconbtn"
              title="Archive (file it away; delete permanently from the Archive)"
              onClick={e => { e.stopPropagation(); onArchive(); }}
            >📦</button>
          )}
        </div>
      )}
    </article>
  );
}
