import { useEffect, useRef, useState } from "react";
import { colorOf } from "./data.js";

// ---------------------------------------------------------------------------
// Team Chat. You can ✎ edit or 🗑 delete YOUR OWN messages (delete removes it
// for everyone, like real chat apps). Avatar colors are looked up live.
// "Clear chat" hides history for you only.
// ---------------------------------------------------------------------------

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ChatPage({ messages, onSend, onEdit, onDelete, onClear, user, people }) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit(e) {
    e.preventDefault();
    onSend(draft);
    setDraft("");
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditText(m.text);
  }
  function saveEdit() {
    onEdit(editingId, editText);
    setEditingId(null);
  }
  function handleDelete(id) {
    if (window.confirm("Delete this message for everyone?")) onDelete(id);
  }
  function handleClear() {
    if (window.confirm("Clear the chat for you? Your teammates will still see the full history.")) {
      onClear();
    }
  }

  return (
    <main className="page chat-page">
      <div className="eyebrow">CATALYST TECHNICAL GROUP</div>
      <div className="chat-titlerow">
        <h1 className="page-title">Team Chat</h1>
        <button className="btn" onClick={handleClear}>🧹 Clear chat (just for you)</button>
      </div>
      <p className="chat-hint">
        A space to raise concerns, ask questions, or just talk — heads up: messages live on
        this computer only until the shared-database upgrade.
      </p>

      <div className="chat-box">
        <div className="chat-scroll">
          {messages.length === 0 && (
            <div className="col-empty">No messages yet — say hi! 👋</div>
          )}
          {messages.map(m => {
            const mine = m.initials === user.initials;
            return (
              <div key={m.id} className={"msg" + (mine ? " msg-mine" : "")}>
                <span className="avatar" style={{ background: colorOf(people, m.initials) || m.color }}>{m.initials}</span>
                <div className="msg-body">
                  <div className="msg-head">
                    <span className="msg-author">{m.author}</span>
                    <span className="msg-time mono">
                      {fmtTime(m.ts)}{m.edited ? " · edited" : ""}
                    </span>
                    {mine && editingId !== m.id && (
                      <span className="msg-tools">
                        <button className="msg-toolbtn" title="Edit message" onClick={() => startEdit(m)}>✎</button>
                        <button className="msg-toolbtn" title="Delete message" onClick={() => handleDelete(m.id)}>🗑</button>
                      </span>
                    )}
                  </div>
                  {editingId === m.id ? (
                    <div className="msg-editrow">
                      <input
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                      <button className="btn" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="msg-text">{m.text}</div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form className="chat-compose" onSubmit={submit}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Write a message..."
          />
          <button type="submit" className="btn btn-primary">Send</button>
        </form>
      </div>
    </main>
  );
}
