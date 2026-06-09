import { useState } from "react";

// ---------------------------------------------------------------------------
// A small chat-style feed, reused for a project's "Updates" and "Roadblocks".
// You can post, and edit/delete your OWN messages (matched by user id),
// exactly like the Team Chat.
// ---------------------------------------------------------------------------

function fmtTime(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function NoteFeed({ title, hint, placeholder, notes, user, onAdd, onEdit, onDelete }) {
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  function post() {
    if (!text.trim()) return;
    onAdd(text);
    setText("");
  }
  function saveEdit() {
    onEdit(editId, editText);
    setEditId(null);
  }

  return (
    <section className="pd-card">
      <h2>{title}</h2>
      {hint && <p className="pd-hint">{hint}</p>}

      <div className="note-feed">
        {notes.length === 0 && <div className="pd-muted">No posts yet.</div>}
        {notes.map(n => {
          const mine = n.user_id === user.id;
          return (
            <div key={n.id} className="note-msg">
              <span className="avatar note-avatar" style={{ background: n.color }}>{n.initials}</span>
              <div className="note-body">
                <div className="note-head">
                  <span className="note-author">{n.author}</span>
                  <span className="note-time mono">{fmtTime(n.ts)}{n.edited ? " · edited" : ""}</span>
                </div>
                {editId === n.id ? (
                  <div className="note-edit">
                    <textarea rows="2" value={editText} onChange={e => setEditText(e.target.value)} />
                    <div className="note-edit-actions">
                      <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                      <button className="btn" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="note-text">{n.text}</div>
                )}
                {mine && editId !== n.id && (
                  <div className="note-actions">
                    <button className="note-link" onClick={() => { setEditId(n.id); setEditText(n.text); }}>Edit</button>
                    <button className="note-link note-link-danger" onClick={() => onDelete(n.id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="note-compose">
        <textarea rows="2" value={text} placeholder={placeholder} onChange={e => setText(e.target.value)} />
        <button className="btn btn-primary" onClick={post} disabled={!text.trim()}>Post</button>
      </div>
    </section>
  );
}
