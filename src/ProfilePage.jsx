import { useState } from "react";
import { AVATAR_COLORS, passwordCheck } from "./data.js";
import PasswordMeter from "./PasswordMeter.jsx";

// ---------------------------------------------------------------------------
// Profile — opened by clicking your name in the nav.
// Edit your avatar color, name, nickname, or email; change your password
// (old password required, new one typed twice).
// Note: your INITIALS stay fixed even if you rename yourself — they're how
// your tasks know they belong to you.
// ---------------------------------------------------------------------------

export default function ProfilePage({ user, onSave, onChangePassword }) {
  // profile form
  const [name, setName] = useState(user.name);
  const [nickname, setNickname] = useState(user.nickname || "");
  const [email, setEmail] = useState(user.email);
  const [color, setColor] = useState(user.color);
  const [profileMsg, setProfileMsg] = useState(null); // {ok, text}

  // password form
  const [oldPw, setOldPw] = useState("");
  const [newPw1, setNewPw1] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwMsg, setPwMsg] = useState(null);

  function submitProfile(e) {
    e.preventDefault();
    const err = onSave({ name, nickname, email, color });
    setProfileMsg(err ? { ok: false, text: err } : { ok: true, text: "Profile saved ✓" });
  }

  function submitPassword(e) {
    e.preventDefault();
    if (!oldPw || !newPw1) return setPwMsg({ ok: false, text: "Please fill out every field." });
    if (newPw1 !== newPw2) return setPwMsg({ ok: false, text: "The new passwords don't match — type the same one twice." });
    const pwError = passwordCheck(newPw1);
    if (pwError) return setPwMsg({ ok: false, text: pwError });
    const err = onChangePassword(oldPw, newPw1);
    if (err) return setPwMsg({ ok: false, text: err });
    setOldPw(""); setNewPw1(""); setNewPw2("");
    setPwMsg({ ok: true, text: "Password changed ✓" });
  }

  return (
    <main className="page">
      <div className="eyebrow">CATALYST TECHNICAL GROUP</div>
      <h1 className="page-title">Your Profile</h1>

      <div className="profile-grid">
        {/* ---- profile card ---- */}
        <form className="profile-card" onSubmit={submitProfile}>
          <h2>Profile</h2>
          <div className="profile-avatar-row">
            <span className="avatar avatar-xl" style={{ background: color }}>{user.initials}</span>
            <div className="swatch-row">
              {AVATAR_COLORS.map(c => (
                <button key={c} type="button"
                  className={"swatch" + (c === color ? " swatch-on" : "")}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`avatar color ${c}`} />
              ))}
            </div>
          </div>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Nickname (one word — replaces your first name around the workspace)</span>
            <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="optional" />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <p className="profile-note mono">Initials stay {user.initials} — they're how your tasks find you.</p>
          {profileMsg && (
            <div className={profileMsg.ok ? "form-ok" : "login-error"}>{profileMsg.text}</div>
          )}
          <button type="submit" className="btn btn-primary">💾 Save profile</button>
        </form>

        {/* ---- password card ---- */}
        <form className="profile-card" onSubmit={submitPassword}>
          <h2>Change password</h2>
          <label className="field">
            <span>Old password</span>
            <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} />
          </label>
          <label className="field">
            <span>New password (15–64 characters)</span>
            <input type="password" value={newPw1} onChange={e => setNewPw1(e.target.value)} />
            <PasswordMeter password={newPw1} />
          </label>
          <label className="field">
            <span>New password (again)</span>
            <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} />
          </label>
          {pwMsg && (
            <div className={pwMsg.ok ? "form-ok" : "login-error"}>{pwMsg.text}</div>
          )}
          <button type="submit" className="btn btn-primary">Change password</button>
        </form>
      </div>
    </main>
  );
}
