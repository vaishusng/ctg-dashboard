import React from "react";

// ---------------------------------------------------------------------------
// Catches any crash anywhere in the app and shows a readable error screen
// instead of a blank white page. The error text it displays is exactly what
// we need to diagnose a problem.
// ---------------------------------------------------------------------------
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        fontFamily: "Archivo, sans-serif", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f1f5f9", padding: 24,
      }}>
        <div style={{
          background: "white", borderRadius: 16, padding: "32px 36px",
          maxWidth: 560, boxShadow: "0 10px 40px rgba(15,23,42,.15)",
        }}>
          <div style={{ fontSize: 40 }}>🚧</div>
          <h1 style={{ margin: "10px 0 6px", fontSize: 24, fontWeight: 800 }}>Something broke</h1>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
            The app hit an error while drawing this screen. Send this message to the developer:
          </p>
          <pre style={{
            background: "#0f172a", color: "#fda4af", borderRadius: 10,
            padding: "12px 14px", fontSize: 12, whiteSpace: "pre-wrap",
            overflowWrap: "anywhere", maxHeight: 180, overflowY: "auto",
          }}>{String(this.state.error && (this.state.error.message || this.state.error))}</pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 14, background: "#2563eb", color: "white", border: "none",
              borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "Archivo, sans-serif",
            }}
          >↻ Reload the app</button>
        </div>
      </div>
    );
  }
}
