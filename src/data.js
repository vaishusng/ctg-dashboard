// ---------------------------------------------------------------------------
// CTG DASHBOARD — shared data + config
// This is the file you edit most: stages, people, the employee signup code.
// ---------------------------------------------------------------------------

// The signup code Madhavi hands to CTG employees. CHANGE THIS to whatever
// you want — anyone without it cannot create an account.
export const EMPLOYEE_CODE = "CTG-2026";

// Sign-ups are restricted to this email domain (CTG's real one)...
export const EMPLOYEE_EMAIL_DOMAIN = "@texasctgroup.com";

// ...except these exact addresses (testing). Remove before the real handoff!
export const ALLOWED_TEST_EMAILS = ["vaishusng@gmail.com"];

// The four board columns, left to right.
export const COLUMNS = ["Not Started", "In Progress", "Completed", "Blocked"];
export const COLUMN_COLOR = {
  "Not Started": "#94a3b8",
  "In Progress": "#2563eb",
  "Completed": "#16a34a",
  "Blocked": "#dc2626",
};

// Project stages (NOTE: not finalized — confirm the real stages with Madhavi).
export const STAGE_COLOR = {
  Proposal: "#7c3aed",
  Permitting: "#0891b2",
  "CTG Work": "#ca8a04",
  Approval: "#059669",
};
export const STAGES = Object.keys(STAGE_COLOR);

export const PRIORITY_COLOR = { high: "#dc2626", med: "#f59e0b", low: "#94a3b8" };
export const PRIORITIES = ["high", "med", "low"];
export const PRIORITY_RANK = { high: 3, med: 2, low: 1 };

// Avatar background colors a new employee can pick from at signup.
export const AVATAR_COLORS = [
  "#0ea5e9", "#f97316", "#8b5cf6", "#10b981",
  "#ef4444", "#eab308", "#ec4899", "#14b8a6",
];

// The starting team. New signups get added to this list automatically.
// (Update initials/names here when you have the real ones.)
export const DEFAULT_PEOPLE = [
  { initials: "TM", name: "Tohith", color: "#10b981" },
  { initials: "VC", name: "Vanessa", color: "#0ea5e9" },
  { initials: "RA", name: "Rafeeq", color: "#f97316" },
  { initials: "MT", name: "Madhavi", color: "#8b5cf6" },
];

export function colorOf(people, initials) {
  return people.find(p => p.initials === initials)?.color || "#94a3b8";
}

// A project's REAL progress: hours-weighted average of its tasks.
//   sum(task progress x task hours) / sum(task hours)
// Falls back to a simple average if no hours are entered, and to the
// manually-set value if the project has no tasks (or auto is turned off).
export function effectiveProgress(project, tasks) {
  if (!project.auto) return Number(project.progress) || 0;
  const pt = tasks.filter(t => t.project === project.name);
  const withHours = pt.filter(t => Number(t.hours) > 0);
  const totalH = withHours.reduce((s, t) => s + Number(t.hours), 0);
  if (totalH > 0)
    return Math.round(withHours.reduce((s, t) => s + t.progress * Number(t.hours), 0) / totalH);
  if (pt.length)
    return Math.round(pt.reduce((s, t) => s + t.progress, 0) / pt.length);
  return Number(project.progress) || 0;
}

// Is a task ON TRACK? Compares actual progress against where it SHOULD be
// based on its start/end dates (and treats past-due unfinished work as red).
//   green = on/ahead of schedule, amber = falling behind, red = behind/past due
// Returns null when the task has no dates to judge by.
export function trackStatus(t) {
  if (t.progress >= 100) return { color: "#16a34a", label: "Done" };
  if (!t.start_date || !t.end_date) return null;
  const start = Date.parse(t.start_date);
  const end = Date.parse(t.end_date);
  const now = Date.now();
  if (!start || !end || end <= start) return null;
  if (now > end) return { color: "#dc2626", label: "Past due" };
  const expected = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const gap = expected - t.progress;
  if (gap <= 5)  return { color: "#16a34a", label: "On track" };
  if (gap <= 25) return { color: "#f59e0b", label: "Falling behind" };
  return { color: "#dc2626", label: "Behind" };
}

// Tasks take their color from their PROJECT (not their stage).
export function projectColor(projects, name) {
  return projects.find(p => p.name === name)?.color || "#64748b";
}

// "Vanessa Martinez" -> "VC"; single names use the first two letters.
export function initialsFromName(name) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] || "?";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}

// ---------------------------------------------------------------------------
// A task's COLUMN is decided by its progress, unless it is blocked:
//   0 = Not Started, 1–99 = In Progress, 100 = Completed.
// ---------------------------------------------------------------------------
export function columnOf(t) {
  if (t.blocked) return "Blocked";
  if (t.progress <= 0) return "Not Started";
  if (t.progress >= 100) return "Completed";
  return "In Progress";
}

// What happens when a card is DROPPED into a column.
export function applyDrop(t, col) {
  if (col === "Blocked") return { ...t, blocked: true };
  const u = { ...t, blocked: false };
  if (col === "Not Started") u.progress = 0;
  else if (col === "Completed") u.progress = 100;
  else if (col === "In Progress" && (u.progress <= 0 || u.progress >= 100)) u.progress = 50;
  return u;
}

export function fmtDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}


// ---------------------------------------------------------------------------
// PASSWORD POLICY (NIST SP 800-63B Rev. 4 style)
//   15-64 characters, NO composition rules, common passwords rejected,
//   no expiration. Length is what matters -> longer = greener.
// ---------------------------------------------------------------------------
const COMMON_PASSWORDS = new Set([
  "password","123456","123456789","12345678","1234567890","12345678901234567890",
  "qwerty","qwertyuiop","qwertyuiopasdfgh","abc123","password1","password123",
  "iloveyou","admin","welcome","monkey","login","letmein","dragon","baseball",
  "football","starwars","superman","batman","trustno1","sunshine","princess",
  "passw0rd","master","hello123","freedom","whatever","qazwsx","shadow",
  "michael","jennifer","jordan23","harley","hunter","ranger","buster",
  "soccer","hockey","killer","george","charlie","andrew","michelle","jessica",
  "pepper","daniel","access","696969","letmein123","passwordpassword",
  "password1234567","password12345678","123456789012345","1234567890123456",
  "qwerty1234567890","iloveyou1234567","welcome123456789","administrator",
  "letmeinletmein1","abcdefghijklmnop","abcdefg123456789","catalysttechnical",
  "ctgdashboard1234","ctg2026ctg2026!","aaaaaaaaaaaaaaa","zzzzzzzzzzzzzzz",
]);

// Returns an error string, or null if the password is acceptable.
export function passwordCheck(pw) {
  if (!pw || pw.length < 15)
    return "Password needs at least 15 characters — try a passphrase, like a few random words with spaces.";
  if (pw.length > 64)
    return "Password can be at most 64 characters.";
  if (new Set(pw).size === 1)
    return "That's one character repeated — pick something less guessable.";
  if (COMMON_PASSWORDS.has(pw.toLowerCase().replace(/\s+/g, "")))
    return "That password is on the list of most commonly used passwords — pick something else.";
  return null;
}

// Strength is driven by LENGTH (the thing that actually matters).
export function passwordStrength(pw) {
  const len = (pw || "").length;
  if (len === 0)  return { pct: 0,  color: "#e2e8f0", label: "" };
  if (len < 15)   return { pct: Math.max(8, (len / 15) * 35), color: "#dc2626", label: `Too short (${len}/15)` };
  if (len < 20)   return { pct: 45, color: "#f59e0b", label: "Okay" };
  if (len < 28)   return { pct: 70, color: "#84cc16", label: "Strong" };
  return { pct: 100, color: "#16a34a", label: "Excellent" };
}

// ---------------------------------------------------------------------------
// Sample data so nothing is empty while you build.
// ---------------------------------------------------------------------------
export const SEED = [
  { id: 1, title: "Draft proposal for Katy daycare site", project: "Katy Daycare", client: "Bright Beginnings LLC", stage: "Proposal", priority: "med", progress: 0, hours: 4, assignees: ["TM"], blocked: false, description: "Put together the initial scope and fee proposal for the new daycare site.", start_date: "2026-06-01", end_date: "2026-06-12" },
  { id: 2, starred: true, title: "Submit drainage plan to Fort Bend County", project: "Sugar Land Retail Center", client: "Riverstone Retail", stage: "Permitting", priority: "high", progress: 45, hours: 8, assignees: ["VC", "TM"], blocked: false, description: "Finalize and submit the stormwater drainage plan for county review.", start_date: "2026-05-20", end_date: "2026-06-20" },
  { id: 3, title: "Run floodplain analysis (HEC-RAS)", project: "Sugar Land Retail Center", client: "Riverstone Retail", stage: "CTG Work", priority: "high", progress: 60, hours: 12, assignees: ["RA"], blocked: false, description: "Model the floodplain and confirm detention sizing.", start_date: "2026-05-15", end_date: "2026-06-18" },
  { id: 4, title: "Site grading & paving drawings", project: "Cypress Subdivision", client: "Northgate Homes", stage: "CTG Work", priority: "med", progress: 0, hours: 10, assignees: ["RA", "VC"], blocked: false, description: "Produce grading and paving sheets for the subdivision.", start_date: "2026-06-05", end_date: "2026-07-01" },
  { id: 5, title: "Health Dept review — restaurant plumbing", project: "Pearland Medical Office", client: "Pearland Med Partners", stage: "Approval", priority: "high", progress: 30, hours: 3, assignees: ["VC"], blocked: true, description: "Awaiting health department sign-off on plumbing layout.", start_date: "2026-05-10", end_date: "2026-06-30" },
  { id: 6, title: "Final plat approval package", project: "Cypress Subdivision", client: "Northgate Homes", stage: "Approval", priority: "low", progress: 100, hours: 6, assignees: ["MT"], blocked: false, description: "Assemble and submit the final plat package for approval.", start_date: "2026-04-01", end_date: "2026-05-28" },
  { id: 7, title: "Tilt-wall panel structural calcs", project: "Pearland Medical Office", client: "Pearland Med Partners", stage: "CTG Work", priority: "med", progress: 100, hours: 9, assignees: ["RA"], blocked: false, description: "Structural calculations for the tilt-wall panels.", start_date: "2026-04-15", end_date: "2026-05-20" },
  { id: 8, title: "Collect client survey & site data", project: "Katy Daycare", client: "Bright Beginnings LLC", stage: "Permitting", priority: "med", progress: 20, hours: 2, assignees: ["TM"], blocked: true, description: "Waiting on the client to send the boundary survey and existing site data.", start_date: "2026-06-02", end_date: "2026-06-16" },
];

// Current + past projects ("history" lives here too — completed ones stay).
export const SEED_PROJECTS = [
  { id: 1, color: "#0ea5e9", auto: true, starred: true, name: "Sugar Land Retail Center", client: "Riverstone Retail", due: "2026-08-15", progress: 55, description: "New 28,000 sf retail strip — civil sitework, stormwater drainage, and structural design." },
  { id: 2, color: "#f97316", auto: true, starred: false, name: "Katy Daycare", client: "Bright Beginnings LLC", due: "2026-09-01", progress: 15, description: "Ground-up daycare facility: platting, permitting coordination, and MEP design." },
  { id: 3, color: "#8b5cf6", auto: true, starred: false, name: "Cypress Subdivision", client: "Northgate Homes", due: "2026-07-10", progress: 80, description: "42-lot residential subdivision — grading, paving, drainage, and final plat." },
  { id: 4, color: "#10b981", auto: true, starred: false, name: "Pearland Medical Office", client: "Pearland Med Partners", due: "2026-06-25", progress: 90, description: "Two-story medical office; tilt-wall structure with health-department coordination." },
  { id: 5, color: "#ec4899", auto: false, starred: false, name: "Richmond Strip Center", client: "GreenPoint Development", due: "2025-11-20", progress: 100, description: "Completed 2025 — retail strip with detention pond redesign and county permitting." },
  { id: 6, color: "#14b8a6", auto: false, starred: false, name: "Fulshear Car Wash", client: "ShinePoint LLC", due: "2024-08-30", progress: 100, description: "Completed 2024 — express car wash, full civil and structural package." },
];
