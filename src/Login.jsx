import { useState } from "react";
import { supabase } from "./supabase.js";
import { EMPLOYEE_CODE, EMPLOYEE_EMAIL_DOMAIN, ALLOWED_TEST_EMAILS, AVATAR_COLORS, initialsFromName, passwordCheck } from "./data.js";
import PasswordMeter from "./PasswordMeter.jsx";

// ---------------------------------------------------------------------------
// Screen 1 — Login / Sign up. REAL auth via Supabase.
//
// Passwords are hashed and stored by Supabase Auth — they never live in this
// app's code or database tables. The employee-code and email-domain checks
// here are just for friendly error messages; the database enforces the same
// rules server-side, so bypassing this screen gets you nothing.
//
// Note: this component doesn't set the logged-in user itself. App.jsx listens
// for auth changes (onAuthStateChange) and reacts — log in here, App hears it.
// ---------------------------------------------------------------------------

export default function Login() {
  const [tab, setTab] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const previewInitials = name.trim() ? initialsFromName(name) : "?";

  async function submit(e) {
    e.preventDefault();
    setError("");
    const emailNorm = email.trim().toLowerCase();

    if (tab === "signup") {
      if (!name.trim() || !emailNorm || !password) return setError("Please fill out every field.");
      if (code.trim() !== EMPLOYEE_CODE) return setError("That employee code isn't valid. Ask Madhavi for the current code.");
      const pwError = passwordCheck(password);
      if (pwError) return setError(pwError);

      setBusy(true);
      // Ask the database whether this email may sign up: a CTG-domain address,
      // or one the owners approved in the allowed_emails table. This replaces the
      // old hardcoded list so owners can add outside emails without a code change.
      const { data: emailOk, error: allowErr } = await supabase.rpc("email_allowed", { check_email: emailNorm });
      if (allowErr) { setBusy(false); return setError("Couldn't verify that email right now. Please try again in a moment."); }
      if (!emailOk) { setBusy(false); return setError("That email isn't approved for sign-up yet. Ask Madhavi or Srujan to add it."); }
      const { error: signUpError } = await supabase.auth.signUp({
        email: emailNorm,
        password,
        options: {
          // This metadata rides along to the database, where the signup
          // trigger re-checks the code and creates the profile row.
          data: {
            name: name.trim(),
            nickname: "",
            initials: initialsFromName(name),
            color,
            employee_code: code.trim(),
          },
        },
      });
      setBusy(false);
      if (signUpError) {
        const msg = (signUpError.message || "").toLowerCase();
        if (msg.includes("already registered"))
          return setError("An account with that email already exists — try logging in.");
        if (msg.includes("database error"))
          return setError("The database rejected that signup — double-check your email and employee code.");
        return setError(signUpError.message);
      }
      // Success — App.jsx hears the SIGNED_IN event and takes it from here.
    } else {
      if (!emailNorm || !password) return setError("Please fill out every field.");
      setBusy(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });
      setBusy(false);
      if (signInError)
        return setError("Email or password doesn't match. New here? Sign up with your employee code.");
      // Success — App.jsx takes it from here.
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

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "One sec..." : tab === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="login-foot">
          {tab === "login"
            ? "Forgot your password? Reset emails arrive with the next upgrade."
            : <>You'll need the employee code from CTG to create an account.</>}
        </p>
      </div>
    </div>
  );
}
