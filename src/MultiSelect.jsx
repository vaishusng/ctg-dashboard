import { useState, useRef, useEffect } from "react";

// A dropdown that shows a summary ("All employees" / "2 selected") and opens a
// checklist with Select all / Clear. Closes when you click outside.
export default function MultiSelect({ options = [], selected = [], onChange, allLabel = "All", placeholder = "None selected" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const allIds = options.map(o => o.value);
  const summary = options.length === 0 || selected.length === options.length
    ? allLabel
    : selected.length === 0 ? placeholder
    : `${selected.length} selected`;

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  return (
    <div className="ms" ref={ref}>
      <button type="button" className="ms-button" onClick={() => setOpen(o => !o)}>
        <span>{summary}</span><span className="ms-caret">▾</span>
      </button>
      {open && (
        <div className="ms-menu">
          <div className="ms-actions">
            <button type="button" onClick={() => onChange(allIds)}>Select all</button>
            <button type="button" onClick={() => onChange([])}>Clear</button>
          </div>
          {options.length === 0 && <div className="ms-empty">No options</div>}
          {options.map(o => (
            <label key={o.value} className="ms-opt">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
