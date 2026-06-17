import { useEffect, useRef, useState } from "react";
import Login from "./Login.jsx";
import HomePage from "./HomePage.jsx";
import Board from "./Board.jsx";
import ProjectsPage from "./ProjectsPage.jsx";
import ProjectDetail from "./ProjectDetail.jsx";
import ReportsPage from "./ReportsPage.jsx";
import WagesPage from "./WagesPage.jsx";
import MyHoursPage from "./MyHoursPage.jsx";
import ChatPage from "./ChatPage.jsx";
import TaskDetail from "./TaskDetail.jsx";
import ProfilePage from "./ProfilePage.jsx";
import { DEFAULT_PEOPLE, applyDrop } from "./data.js";
import { supabase } from "./supabase.js";

// ---------------------------------------------------------------------------
// App = the brain. Pages: Home, Tasks, Projects (grid -> project detail),
// Team Chat, and Profile.
//
// EVERYTHING now lives in Supabase (the cloud database), not localStorage:
//   - tasks & projects are shared tables; "trash" is just a `trashed` flag
//   - team chat is the messages table
//   - each person's "clear chat" point is saved on their profile row
// The pattern for every change: write to the database, then re-load that
// table so the screen matches. Realtime (set up below) also re-loads when a
// TEAMMATE changes something — that's how two browsers stay in sync.
//
// Archived tasks STAY in the tasks list with archived: true — they're hidden
// from the board but still count toward project progress (finished work is
// still work).
// ---------------------------------------------------------------------------

// Only send real table columns to the database (drop id, created_at, etc.),
// and turn empty date strings into null (a date column rejects "").
function cleanTask(t) {
  const cols = ["title","project","client","stage","priority","progress","hours",
    "type","assignees","blocked","starred","archived","trashed","description",
    "start_date","end_date","comments"];
  const out = {};
  for (const k of cols) if (k in t) out[k] = t[k];
  if (out.start_date === "") out.start_date = null;
  if (out.end_date === "") out.end_date = null;
  if ("progress" in out) out.progress = Number(out.progress) || 0;
  if ("hours" in out) out.hours = Number(out.hours) || 0;
  return out;
}
function cleanProject(p) {
  const cols = ["name","client","color","auto","starred","trashed","due","progress","description",
    "manager","assignees","updates_text","roadblocks_text"];
  const out = {};
  for (const k of cols) if (k in p) out[k] = p[k];
  if (out.due === "") out.due = null;
  if ("progress" in out) out.progress = Number(out.progress) || 0;
  return out;
}

const PAGES = ["Home", "Projects", "Tasks", "My Hours", "Wages", "Project Report", "Team Chat"];
// Tabs only owners (admins) should see in the top nav.
const ADMIN_ONLY_PAGES = ["Wages"];

export default function App() {
  const [user, setUser] = useState(null);          // set by Supabase auth listener below
  const [authReady, setAuthReady] = useState(false); // false until we've checked for a session
  const [people, setPeople] = useState(DEFAULT_PEOPLE);

  // These start empty and fill from the database once you're logged in.
  const [tasks, setTasks] = useState([]);
  const [trash, setTrash] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projTrash, setProjTrash] = useState([]);
  const [messages, setMessages] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [projectNotes, setProjectNotes] = useState([]);
  const [staff, setStaff] = useState([]);   // full profiles (with ids), admin wage editing
  const [wages, setWages] = useState([]);    // [{ user_id, hourly_rate }], admin-only
  const [timeLogs, setTimeLogs] = useState([]); // the logged-in person's own hours
  const [taskHours, setTaskHours] = useState({}); // { task_id: total logged hours }, team-wide
  const [allHours, setAllHours] = useState([]); // team-wide hours, no money: [{ user_id, project_id, hours, date }]
  const [budgets, setBudgets] = useState([]);   // [{ project_id, amount }], admin-only
  const [costs, setCosts] = useState({});        // { project_id: totalLaborCost }, admin-only
  const [laborLogs, setLaborLogs] = useState([]); // joined hours+rate rows, admin-only
  const [dataReady, setDataReady] = useState(false);

  // Remember which screen you were on across tab switches, new tabs, and
  // reloads by saving it in the browser. Falls back to defaults first time.
  const [page, setPage] = useState(() => {
    try { return localStorage.getItem("ctg_page") || "Home"; } catch { return "Home"; }
  });
  const [taskView, setTaskView] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ctg_taskview")) || { name: "board" }; }
    catch { return { name: "board" }; }
  });
  const [projView, setProjView] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ctg_projview")) || { name: "grid" }; }
    catch { return { name: "grid" }; }
  });
  useEffect(() => { localStorage.setItem("ctg_page", page); }, [page]);
  useEffect(() => { localStorage.setItem("ctg_taskview", JSON.stringify(taskView)); }, [taskView]);
  useEffect(() => { localStorage.setItem("ctg_projview", JSON.stringify(projView)); }, [projView]);

  // Mirror of `user` we can read synchronously inside the auth listener.
  // Lets us tell a genuine new sign-in (user was null) apart from a
  // background token refresh on tab refocus (user already set).
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // ---- Supabase auth: react to log in / log out events. ----
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {            // logged out, or no session on first load
        setUser(null);
        setAuthReady(true);
        return;
      }
      // Load the profile only the FIRST time we see a session this page-load.
      // Switching tabs/coming back fires this again, but userRef is already
      // set, so we skip. We never force a screen here; the saved screen
      // (above) is restored, so you stay exactly where you were.
      if (!userRef.current) {
        loadUser(session.user);
      }
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ---- Once logged in: load all the data, and subscribe to live changes ----
  useEffect(() => {
    if (!user) return;
    loadTasks();
    loadProjects();
    loadMessages();
    loadMilestones();
    loadDecisions();
    loadProjectNotes();
    loadTimeLogs();
    loadTaskHours();
    loadAllHours();
    if (user.is_admin) { loadWages(); loadBudgets(); loadCosts(); }
    setDataReady(true);

    // Realtime: when anyone changes these tables, re-load them here.
    const channel = supabase.channel("ctg-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadTasks)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, loadProjects)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, loadMessages)
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, loadMilestones)
      .on("postgres_changes", { event: "*", schema: "public", table: "decisions" }, loadDecisions)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_notes" }, loadProjectNotes)
      .on("postgres_changes", { event: "*", schema: "public", table: "wages" }, () => { if (user.is_admin) loadWages(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "time_logs" }, () => { loadTimeLogs(); loadTaskHours(); loadAllHours(); if (user.is_admin) loadCosts(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "time_log_rates" }, () => { if (user.is_admin) loadCosts(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_budgets" }, () => { if (user.is_admin) loadBudgets(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pull this person's profile row (name, initials, color...) into `user`.
  async function loadUser(authUser) {
    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", authUser.id).single();
    if (profile) {
      setUser({
        id: profile.id,
        name: profile.name,
        nickname: profile.nickname || "",
        email: profile.email,
        initials: profile.initials,
        color: profile.color,
        chat_cleared_at: profile.chat_cleared_at || "",
        is_admin: !!profile.is_admin,
      });
      refreshPeople();
    }
    setAuthReady(true);
  }

  // The people list = everyone with an account, plus the built-in starter
  // initials (TM/VC/RA/MT) so seed tasks keep their colors pre-signup.
  async function refreshPeople() {
    const { data } = await supabase.from("profiles").select("id,initials,name,color");
    const merged = [...(data || [])];
    for (const p of DEFAULT_PEOPLE)
      if (!merged.some(m => m.initials === p.initials)) merged.push(p);
    setPeople(merged);
  }

  // ---- loaders (read from the database into the screen) ----
  async function loadTasks() {
    const { data } = await supabase.from("tasks").select("*").order("id");
    const rows = (data || []).map(t => ({
      ...t,
      assignees: Array.isArray(t.assignees) ? t.assignees : [],
      comments: Array.isArray(t.comments) ? t.comments : [],
    }));
    setTasks(rows.filter(t => !t.trashed));
    setTrash(rows.filter(t => t.trashed));
  }
  async function loadProjects() {
    const { data } = await supabase.from("projects").select("*").order("id");
    const rows = data || [];
    setProjects(rows.filter(p => !p.trashed));
    setProjTrash(rows.filter(p => p.trashed));
  }
  async function loadMessages() {
    const { data } = await supabase.from("messages").select("*").order("ts");
    setMessages(data || []);
  }
  async function loadMilestones() {
    const { data } = await supabase.from("milestones").select("*").order("due", { nullsFirst: false });
    setMilestones(data || []);
  }
  async function loadDecisions() {
    const { data } = await supabase.from("decisions").select("*").order("created_at");
    setDecisions(data || []);
  }
  // Admin-only: staff list (with ids) + their hourly rates.
  async function loadWages() {
    const { data: profs } = await supabase
      .from("profiles").select("id,name,initials,color").order("name");
    setStaff(profs || []);
    const { data: w } = await supabase.from("wages").select("user_id,hourly_rate");
    setWages(w || []);
  }
  // Admin-only: per-project budgets (kept off the world-readable projects table).
  async function loadBudgets() {
    const { data } = await supabase.from("project_budgets").select("project_id,amount");
    setBudgets(data || []);
  }
  const budgetOf = (projectId) => {
    const b = budgets.find(x => x.project_id === projectId);
    return b ? Number(b.amount) : 0;
  };
  // Admin-only: total labor cost per project = sum of (hours * snapshotted rate)
  // across every worker's entries. Hours and rates live in separate tables.
  async function loadCosts() {
    const { data: logs } = await supabase.from("time_logs").select("id,user_id,project_id,task_id,hours,work_date,note");
    const { data: rates } = await supabase.from("time_log_rates").select("log_id,rate_applied");
    const rateMap = {};
    (rates || []).forEach(r => { rateMap[r.log_id] = Number(r.rate_applied) || 0; });
    const joined = (logs || []).map(l => ({
      user_id: l.user_id, project_id: l.project_id, task_id: l.task_id,
      hours: Number(l.hours) || 0, rate: rateMap[l.id] || 0,
      date: l.work_date, note: l.note || "",
    }));
    setLaborLogs(joined);
    const acc = {};
    joined.forEach(l => { acc[l.project_id] = (acc[l.project_id] || 0) + l.hours * l.rate; });
    setCosts(acc);
  }
  // Per-worker hours and cost for one project, for the owners-only report table.
  // Rate shown is the effective rate (cost / hours), so it reconciles even when
  // a person's wage changed partway through.
  function projectLabor(projectId) {
    const byUser = {};
    laborLogs.filter(l => l.project_id === projectId).forEach(l => {
      if (!byUser[l.user_id]) byUser[l.user_id] = { user_id: l.user_id, hours: 0, cost: 0 };
      byUser[l.user_id].hours += l.hours;
      byUser[l.user_id].cost += l.hours * l.rate;
    });
    return Object.values(byUser).map(u => {
      const p = staff.find(s => s.id === u.user_id);
      return {
        ...u,
        name: p ? p.name : "(former member)",
        initials: p ? p.initials : "??",
        rate: u.hours > 0 ? u.cost / u.hours : 0,
      };
    }).sort((a, b) => b.cost - a.cost);
  }
  // Per-entry rows for the detailed report view (one row per logged entry).
  function projectEntries(projectId) {
    return laborLogs
      .filter(l => l.project_id === projectId)
      .map(l => {
        const p = staff.find(s => s.id === l.user_id);
        const t = tasks.find(x => x.id === l.task_id);
        return {
          user_id: l.user_id,
          name: p ? p.name : "(former member)",
          initials: p ? p.initials : "??",
          task: t ? t.title : "",
          taskEst: t ? (Number(t.hours) || 0) : null,
          date: l.date,
          note: l.note,
          hours: l.hours,
          rate: l.rate,
          amount: l.hours * l.rate,
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  // budget - cost. Negative = over (red). Within 5% of budget remaining = on
  // (amber). More than 5% remaining = under (green). No budget set = neutral.
  function budgetStatus(projectId) {
    const budget = budgetOf(projectId);
    const cost = costs[projectId] || 0;
    if (!(budget > 0)) return { label: "No budget set", color: "#94a3b8", variance: null, cost };
    const variance = budget - cost;
    if (variance < 0) return { label: "Over budget", color: "#dc2626", variance, cost };
    if (variance <= 0.05 * budget) return { label: "On budget", color: "#f59e0b", variance, cost };
    return { label: "Under budget", color: "#16a34a", variance, cost };
  }
  // Admin-only: set or update one person's hourly rate.
  async function saveWage(userId, rate) {
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0) return "Enter a rate of 0 or more.";
    const { error } = await supabase.from("wages").upsert({
      user_id: userId,
      hourly_rate: value,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });
    if (error) return "Couldn't save that rate; try again.";
    loadWages();
    return null;
  }
  // ---- time logs (everyone logs their OWN hours; rate is snapshotted by a db trigger) ----
  async function loadTimeLogs() {
    const { data } = await supabase
      .from("time_logs").select("*")
      .eq("user_id", user.id)
      .order("work_date", { ascending: false });
    setTimeLogs(data || []);
  }
  // Team-wide hours logged per task (no money), so the report's Tasks section
  // can show real time spent to everyone.
  async function loadTaskHours() {
    const { data } = await supabase.from("time_logs").select("task_id,hours");
    const acc = {};
    (data || []).forEach(l => { if (l.task_id != null) acc[l.task_id] = (acc[l.task_id] || 0) + (Number(l.hours) || 0); });
    setTaskHours(acc);
  }
  // Team-wide hours per project per person (no money), readable by everyone, so a
  // non-admin can run the Consolidated project / employee / hours report.
  async function loadAllHours() {
    const { data } = await supabase.from("time_logs").select("user_id,project_id,hours,work_date");
    setAllHours((data || []).map(l => ({
      user_id: l.user_id, project_id: l.project_id,
      hours: Number(l.hours) || 0, date: l.work_date,
    })));
  }
  async function addTimeLog({ project_id, task_id, hours, work_date, note }) {
    await supabase.from("time_logs").insert({
      user_id: user.id,
      project_id,
      task_id: task_id || null,
      hours: Number(hours) || 0,
      work_date,
      note: note || "",
    });
    loadTimeLogs();
    loadTaskHours();
    loadAllHours();
    if (user.is_admin) loadCosts();
  }
  async function updateTimeLog(id, patch) {
    await supabase.from("time_logs").update(patch).eq("id", id);
    loadTimeLogs();
    loadTaskHours();
    loadAllHours();
    if (user.is_admin) loadCosts();
  }
  async function deleteTimeLog(id) {
    await supabase.from("time_logs").delete().eq("id", id);
    loadTimeLogs();
    loadTaskHours();
    loadAllHours();
    if (user.is_admin) loadCosts();
  }

  // ---- milestones ----
  async function addMilestone(m) {
    await supabase.from("milestones").insert(m);
    loadMilestones();
  }
  async function updateMilestone(id, patch) {
    await supabase.from("milestones").update(patch).eq("id", id);
    loadMilestones();
  }
  async function deleteMilestone(id) {
    await supabase.from("milestones").delete().eq("id", id);
    loadMilestones();
  }

  // ---- decisions ----
  async function addDecision(d) {
    await supabase.from("decisions").insert(d);
    loadDecisions();
  }
  async function updateDecision(id, patch) {
    await supabase.from("decisions").update(patch).eq("id", id);
    loadDecisions();
  }
  async function deleteDecision(id) {
    await supabase.from("decisions").delete().eq("id", id);
    loadDecisions();
  }

  // ---- project notes (chat-style Updates & Roadblocks feeds) ----
  async function loadProjectNotes() {
    const { data } = await supabase.from("project_notes").select("*").order("ts");
    setProjectNotes(data || []);
  }
  async function addProjectNote({ project_id, kind, text }) {
    if (!text.trim()) return;
    await supabase.from("project_notes").insert({
      project_id, kind,
      author: firstName(user), initials: user.initials, color: user.color,
      text: text.trim(),
    });
    loadProjectNotes();
  }
  async function editProjectNote(id, text) {
    if (!text.trim()) return;
    await supabase.from("project_notes").update({ text: text.trim(), edited: true }).eq("id", id);
    loadProjectNotes();
  }
  async function deleteProjectNote(id) {
    await supabase.from("project_notes").delete().eq("id", id);
    loadProjectNotes();
  }

  const firstName = (u) => (u.nickname || u.name.split(" ")[0]);

  // ---- profile (saved to the shared profiles table) ----
  async function saveProfile({ name, nickname, email, color }) {
    if (!name.trim()) return "Name can't be empty.";
    if (email.trim().toLowerCase() !== user.email)
      return "Email changes aren't supported yet — that arrives with a later upgrade.";
    const nick = nickname.trim().split(/\s+/)[0] || "";
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), nickname: nick, color })
      .eq("id", user.id);
    if (error) return "Couldn't save your profile — check your connection and try again.";
    setUser({ ...user, name: name.trim(), nickname: nick, color });
    refreshPeople();
    return null;
  }

  async function changePassword(oldPw, newPw) {
    // Verify the old password by quietly re-logging-in with it.
    const { error: oldErr } = await supabase.auth.signInWithPassword({
      email: user.email, password: oldPw,
    });
    if (oldErr) return "Old password doesn't match.";
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return "Couldn't change the password — try again in a moment.";
    return null;
  }

  // ---- task operations (write to db, then re-load) ----
  async function addTask(data) {
    await supabase.from("tasks").insert(cleanTask(data));
    loadTasks();
  }
  async function updateTask(u) {
    await supabase.from("tasks").update(cleanTask(u)).eq("id", u.id);
    loadTasks();
  }
  async function dropTask(id, col) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const u = applyDrop(t, col);
    await supabase.from("tasks").update({ blocked: u.blocked, progress: u.progress }).eq("id", id);
    loadTasks();
  }
  async function toggleTaskStar(id) {
    const t = [...tasks, ...trash].find(x => x.id === id);
    if (!t) return;
    await supabase.from("tasks").update({ starred: !t.starred }).eq("id", id);
    loadTasks();
  }
  async function unarchiveTask(id) {
    await supabase.from("tasks").update({ archived: false }).eq("id", id);
    loadTasks();
  }
  async function trashTask(id) {
    await supabase.from("tasks").update({ trashed: true }).eq("id", id);
    if (taskView.name === "task" && taskView.id === id) setTaskView({ name: "board" });
    loadTasks();
  }
  async function recoverTask(id) {
    await supabase.from("tasks").update({ trashed: false }).eq("id", id);
    loadTasks();
  }
  async function purgeTask(id) {
    await supabase.from("tasks").delete().eq("id", id);
    loadTasks();
  }

  // Bulk actions for the Select mode (and single archive uses it too).
  async function bulkTasks(ids, action) {
    if (!ids || !ids.length) return;
    if (action === "purge") {  // delete forever from trash
      await supabase.from("tasks").delete().in("id", ids);
      loadTasks();
      return;
    }
    let patch = null;
    if (action === "trash")     patch = { trashed: true };
    if (action === "recover")   patch = { trashed: false };
    if (action === "complete")  patch = { progress: 100, blocked: false };
    if (action === "block")     patch = { blocked: true };
    if (action === "unblock")   patch = { blocked: false };
    if (action === "archive")   patch = { archived: true, progress: 100, blocked: false };
    if (action === "unarchive") patch = { archived: false };
    if (!patch) return;
    await supabase.from("tasks").update(patch).in("id", ids);
    if (action === "trash" && taskView.name === "task" && ids.includes(taskView.id))
      setTaskView({ name: "board" });
    loadTasks();
  }

  // ---- task comments (the per-task updates feed, stored on the task) ----
  async function saveComments(taskId, comments) {
    await supabase.from("tasks").update({ comments }).eq("id", taskId);
    loadTasks();
  }
  function addTaskComment(taskId, text) {
    if (!text.trim()) return;
    const t = [...tasks, ...trash].find(x => x.id === taskId);
    if (!t) return;
    const comment = {
      id: Date.now(),
      author: firstName(user),
      initials: user.initials,
      color: user.color,
      text: text.trim(),
      ts: new Date().toISOString(),
    };
    saveComments(taskId, [...(t.comments || []), comment]);
  }
  function editTaskComment(taskId, commentId, text) {
    if (!text.trim()) return;
    const t = [...tasks, ...trash].find(x => x.id === taskId);
    if (!t) return;
    const next = (t.comments || []).map(c =>
      c.id === commentId ? { ...c, text: text.trim(), edited: true } : c);
    saveComments(taskId, next);
  }
  function deleteTaskComment(taskId, commentId) {
    const t = [...tasks, ...trash].find(x => x.id === taskId);
    if (!t) return;
    saveComments(taskId, (t.comments || []).filter(c => c.id !== commentId));
  }

  // ---- project operations ----
  async function addProject(data) {
    const { data: row } = await supabase.from("projects").insert(cleanProject(data)).select("id").single();
    if (user.is_admin && row && data.budget !== undefined) {
      await supabase.from("project_budgets").upsert({
        project_id: row.id, amount: Number(data.budget) || 0,
        updated_at: new Date().toISOString(), updated_by: user.id,
      });
      loadBudgets();
    }
    loadProjects();
  }
  async function updateProject(u) {
    await supabase.from("projects").update(cleanProject(u)).eq("id", u.id);
    if (user.is_admin && u.budget !== undefined) {
      await supabase.from("project_budgets").upsert({
        project_id: u.id, amount: Number(u.budget) || 0,
        updated_at: new Date().toISOString(), updated_by: user.id,
      });
      loadBudgets();
    }
    loadProjects();
  }
  async function toggleProjectStar(id) {
    const p = [...projects, ...projTrash].find(x => x.id === id);
    if (!p) return;
    await supabase.from("projects").update({ starred: !p.starred }).eq("id", id);
    loadProjects();
  }
  async function trashProject(id) {
    await supabase.from("projects").update({ trashed: true }).eq("id", id);
    if (projView.name === "project" && projView.id === id) setProjView({ name: "grid" });
    loadProjects();
  }
  async function recoverProject(id) {
    await supabase.from("projects").update({ trashed: false }).eq("id", id);
    loadProjects();
  }
  async function purgeProject(id) {
    await supabase.from("projects").delete().eq("id", id);
    loadProjects();
  }
  async function bulkProjects(ids, action) {
    if (!ids || !ids.length) return;
    if (action === "purge") {  // delete forever from trash
      await supabase.from("projects").delete().in("id", ids);
      loadProjects();
      return;
    }
    if (action === "trash") {
      await supabase.from("projects").update({ trashed: true }).in("id", ids);
      if (projView.name === "project" && ids.includes(projView.id)) setProjView({ name: "grid" });
      loadProjects();
      return;
    }
    if (action === "recover") {
      await supabase.from("projects").update({ trashed: false }).in("id", ids);
      loadProjects();
      return;
    }
    if (action === "done") {
      await supabase.from("projects").update({ auto: false, progress: 100 }).in("id", ids);
      loadProjects();
    }
  }

  // ---- chat ----
  async function sendMessage(text) {
    if (!text.trim()) return;
    // user_id is filled in automatically by the database (= the logged-in user).
    await supabase.from("messages").insert({
      author: firstName(user),
      initials: user.initials,
      color: user.color,
      text: text.trim(),
    });
    loadMessages();
  }
  async function editMessage(id, text) {
    if (!text.trim()) return;
    await supabase.from("messages").update({ text: text.trim(), edited: true }).eq("id", id);
    loadMessages();
  }
  async function deleteMessage(id) {
    await supabase.from("messages").delete().eq("id", id);
    loadMessages();
  }
  async function clearChat() {
    const now = new Date().toISOString();
    await supabase.from("profiles").update({ chat_cleared_at: now }).eq("id", user.id);
    setUser({ ...user, chat_cleared_at: now });
  }

  if (!authReady) return <div className="login-page"><div className="login-card"><div className="login-mark">C</div><p className="login-sub">Loading...</p></div></div>;
  if (!user) return <Login />;

  const clearedAt = user.chat_cleared_at || "";
  const visibleMessages = messages.filter(m => m.ts > clearedAt);

  const currentTask = taskView.name === "task" ? tasks.find(t => t.id === taskView.id) : null;
  const currentProject = projView.name === "project" ? projects.find(p => p.id === projView.id) : null;

  function go(p) {
    setPage(p);
    setTaskView({ name: "board" });
    setProjView({ name: "grid" });
  }
  function openTaskFromHome(id) {
    setPage("Tasks");
    setProjView({ name: "grid" });
    setTaskView({ name: "task", id, mode: "view" });
  }
  function openProjectFromHome(id) {
    setPage("Projects");
    setTaskView({ name: "board" });
    setProjView({ name: "project", id });
  }

  const taskDetail = currentTask && (
    <TaskDetail
      task={currentTask}
      people={people}
      projects={projects}
      user={user}
      onAddComment={(text) => addTaskComment(currentTask.id, text)}
      onEditComment={(cid, text) => editTaskComment(currentTask.id, cid, text)}
      onDeleteComment={(cid) => deleteTaskComment(currentTask.id, cid)}
      mode={taskView.mode}
      onEdit={() => setTaskView({ ...taskView, mode: "edit" })}
      onCancel={() => setTaskView({ ...taskView, mode: "view" })}
      onSave={(t) => { updateTask(t); setTaskView({ name: "board" }); }}
      onBack={() => setTaskView({ name: "board" })}
      onTrash={() => trashTask(currentTask.id)}
    />
  );

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-logo">C</span>
        <span className="nav-brand">CTG Workspace</span>
        {PAGES.filter(p => !ADMIN_ONLY_PAGES.includes(p) || user.is_admin).map(p => (
          <button key={p} className={"nav-btn" + (page === p ? " nav-btn-active" : "")} onClick={() => go(p)}>
            {p}
          </button>
        ))}
        <span className="nav-spacer" />
        <button className="nav-profile" onClick={() => go("Profile")} title="Edit your profile">
          <span className="avatar nav-avatar" style={{ background: user.color || "#94a3b8" }}>{user.initials}</span>
          <span className="nav-user">{firstName(user)}</span>
        </button>
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
      </nav>
      <div className="subnav">
        {(() => {
          const trail = ["Workspace", page];
          if (page === "Projects" && currentProject) trail.push(currentProject.name);
          if (currentTask && taskView.name === "task") trail.push(currentTask.title);
          return trail.map((part, i) => (
            <span key={i}>
              {i > 0 && <>&nbsp;/&nbsp;</>}
              {i === trail.length - 1 ? <b>{part}</b> : part}
            </span>
          ));
        })()}
      </div>

      {page === "Home" && (
        <HomePage
          tasks={tasks}
          projects={projects}
          user={user}
          onGo={go}
          onOpenTask={openTaskFromHome}
          onOpenProject={openProjectFromHome}
        />
      )}

      {page === "Tasks" && (
        taskView.name === "task" && currentTask ? taskDetail : (
          <Board
            tasks={tasks}
            trash={trash}
            people={people}
            projects={projects}
            onOpen={(id) => setTaskView({ name: "task", id, mode: "view" })}
            onDrop={dropTask}
            onAdd={addTask}
            onStar={toggleTaskStar}
            onTrash={trashTask}
            onRecover={recoverTask}
            onPurge={purgeTask}
            onBulk={bulkTasks}
            onUnarchive={unarchiveTask}
          />
        )
      )}

      {page === "Projects" && (
        taskView.name === "task" && currentTask ? taskDetail : (
          projView.name === "project" && currentProject ? (
            <ProjectDetail
              project={currentProject}
              tasks={tasks}
              people={people}
              projects={projects}
              milestones={milestones.filter(m => m.project_id === currentProject.id)}
              decisions={decisions.filter(d => d.project_id === currentProject.id)}
              projectNotes={projectNotes.filter(n => n.project_id === currentProject.id)}
              user={user}
              onAddMilestone={(m) => addMilestone({ ...m, project_id: currentProject.id })}
              onUpdateMilestone={updateMilestone}
              onDeleteMilestone={deleteMilestone}
              onAddDecision={(d) => addDecision({ ...d, project_id: currentProject.id })}
              onUpdateDecision={updateDecision}
              onDeleteDecision={deleteDecision}
              onAddNote={(kind, text) => addProjectNote({ project_id: currentProject.id, kind, text })}
              onEditNote={editProjectNote}
              onDeleteNote={deleteProjectNote}
              onOpenTask={(id) => setTaskView({ name: "task", id, mode: "view" })}
              onAddTask={addTask}
              onBack={() => setProjView({ name: "grid" })}
              onUpdateProject={updateProject}
              budget={budgetOf(currentProject.id)}
              budgetStatus={user.is_admin ? budgetStatus(currentProject.id) : null}
              onToggleStar={toggleTaskStar}
              onArchive={(id) => bulkTasks([id], "archive")}
              onTrashTask={trashTask}
            />
          ) : (
            <ProjectsPage
              projects={projects}
              tasks={tasks}
              trash={projTrash}
              people={people}
              onOpen={(id) => setProjView({ name: "project", id })}
              onAdd={addProject}
              onUpdate={updateProject}
              onStar={toggleProjectStar}
              onTrash={trashProject}
              onRecover={recoverProject}
              onPurge={purgeProject}
              onBulk={bulkProjects}
              isAdmin={user.is_admin}
              budgets={budgets}
            />
          )
        )
      )}

      {page === "My Hours" && (
        <MyHoursPage
          projects={projects}
          tasks={tasks}
          logs={timeLogs}
          onAdd={addTimeLog}
          onUpdate={updateTimeLog}
          onDelete={deleteTimeLog}
        />
      )}

      {page === "Wages" && user.is_admin && (
        <WagesPage staff={staff} wages={wages} onSave={saveWage} />
      )}

      {page === "Project Report" && (
        <ReportsPage
          projects={projects}
          tasks={tasks}
          people={people}
          milestones={milestones}
          decisions={decisions}
          projectNotes={projectNotes}
          taskHours={taskHours}
          isAdmin={user.is_admin}
          budgetOf={budgetOf}
          budgetStatus={budgetStatus}
          projectLabor={projectLabor}
          projectEntries={projectEntries}
          hoursEntries={allHours}
        />
      )}

      {page === "Team Chat" && (
        <ChatPage
          messages={visibleMessages}
          onSend={sendMessage}
          onEdit={editMessage}
          onDelete={deleteMessage}
          onClear={clearChat}
          user={user}
          people={people}
        />
      )}

      {page === "Profile" && (
        <ProfilePage user={user} onSave={saveProfile} onChangePassword={changePassword} />
      )}
    </div>
  );
}
