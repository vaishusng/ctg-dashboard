import { useState } from "react";
import { EMPLOYEE_CODE, EMPLOYEE_EMAIL_DOMAIN, ALLOWED_TEST_EMAILS, AVATAR_COLORS, initialsFromName, passwordCheck } from "./data.js";
import PasswordMeter from "./PasswordMeter.jsx";

// ---------------------------------------------------------------------------
// Screen 1 — Login / Sign up.
//
// PLACEHOLDER auth so the app works end-to-end today: accounts live in this
// browser's localStorage (not encrypted, not shared between computers).
// The Supabase upgrade replaces the storage with real secure auth — and adds
// "forgot password" emails. The screen itself stays the same.
// ---------------------------------------------------------------------------

function loadAccounts() {
  try { return JSON.parse(localStorage.getItem("ctg_accounts")) || []; }
  catch { return []; }
}

export default function Login({ onAuth }) {
  const [tab, setTab] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState("");

  const previewInitials = name.trim() ? initialsFromName(name) : "?";

  function submit(e) {
    e.preventDefault();
    setError("");
    const accounts = loadAccounts();

    if (tab === "signup") {
      if (!name.trim() || !email.trim() || !password) return setError("Please fill out every field.");
      const emailNorm = email.trim().toLowerCase();
      if (!emailNorm.endsWith(EMPLOYEE_EMAIL_DOMAIN) && !ALLOWED_TEST_EMAILS.includes(emailNorm))
        return setError(`Sign-ups are restricted to CTG employees — use your ${EMPLOYEE_EMAIL_DOMAIN} email.`);
      if (code.trim() !== EMPLOYEE_CODE) return setError("That employee code isn't valid. Ask Madhavi for the current code.");
      const pwError = passwordCheck(password);
      if (pwError) return setError(pwError);
      if (accounts.some(a => a.email === email.trim().toLowerCase()))
        return setError("An account with that email already exists — try logging in.");
      const account = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        color,
        initials: initialsFromName(name),
        nickname: "",
      };
      localStorage.setItem("ctg_accounts", JSON.stringify([...accounts, account]));
      onAuth(account);
    } else {
      const acc = accounts.find(a => a.email === email.trim().toLowerCase() && a.password === password);
      if (!acc) return setError("Email or password doesn't match. New here? Sign up with your employee code.");
      // older accounts may not have a color/initials yet — fill them in
      onAuth({
        ...acc,
        initials: acc.initials || initialsFromName(acc.name),
        color: acc.color || AVATAR_COLORS[0],
      });
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-mark">C</div>
        <div className="login-eyebrow">CATALYST TECHNICAL GROUP</div>
        <h1 className="login-title">Welcome</h1>
        <p className="login-sub">Sign in to the CTG workspace.</p>

        <div className="login-tabs">
          <button className={tab === "login" ? "tab tab-active" : "tab"} onClick={() => { setTab("login"); setError(""); }}>Log in</button>
          <button className={tab === "signup" ? "tab tab-active" : "tab"} onClick={() => { setTab("signup"); setError(""); }}>Sign up</button>
        </div>

        <form onSubmit={submit} className="login-form">
          {tab === "signup" && (
            <label className="field">
              <span>Full name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Vanessa Martinez" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@texasctgroup.com" />
          </label>
          <label className="field">
            <span>Password{tab === "signup" ? " (15–64 characters — a passphrase works great)" : ""}</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            {tab === "signup" && <PasswordMeter password={password} />}
          </label>
          {tab === "signup" && (
            <>
              <label className="field">
                <span>Employee code</span>
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="Provided by CTG" />
              </label>
              <div className="field">
                <span>Pick your avatar color</span>
                <div className="swatch-row">
                  <span className="avatar avatar-preview" style={{ background: color }}>{previewInitials}</span>
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={"swatch" + (c === color ? " swatch-on" : "")}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                      aria-label={`avatar color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block">
            {tab === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="login-foot">
          {tab === "login"
            ? "Forgot your password? Reset emails arrive with the secure-login upgrade — for now, create a fresh account."
            : <>You'll need the employee code from CTG to create an account.</>}
        </p>
      </div>
    </div>
  );
}
