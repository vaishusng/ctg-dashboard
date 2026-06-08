import { useEffect, useState } from "react";
import Login from "./Login.jsx";
import HomePage from "./HomePage.jsx";
import Board from "./Board.jsx";
import ProjectsPage from "./ProjectsPage.jsx";
import ProjectDetail from "./ProjectDetail.jsx";
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
    "assignees","blocked","starred","archived","trashed","description",
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
  const cols = ["name","client","color","auto","starred","trashed","due","progress","description"];
  const out = {};
  for (const k of cols) if (k in p) out[k] = p[k];
  if (out.due === "") out.due = null;
  if ("progress" in out) out.progress = Number(out.progress) || 0;
  return out;
}

const PAGES = ["Home", "Projects", "Tasks", "Team Chat"];

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
  const [dataReady, setDataReady] = useState(false);

  const [page, setPage] = useState("Home");
  const [taskView, setTaskView] = useState({ name: "board" });
  const [projView, setProjView] = useState({ name: "grid" });

  // ---- Supabase auth: restore the session on load, and listen for
  // log in / log out events (Login.jsx triggers these; we react here). ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadUser(session.user);
      else setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadUser(session.user);
      else { setUser(null); setAuthReady(true); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ---- Once logged in: load all the data, and subscribe to live changes ----
  useEffect(() => {
    if (!user) return;
    loadTasks();
    loadProjects();
    loadMessages();
    setDataReady(true);

    // Realtime: when anyone changes these tables, re-load them here.
    const channel = supabase.channel("ctg-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadTasks)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, loadProjects)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, loadMessages)
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
      });
      refreshPeople();
      setPage("Home");
    }
    setAuthReady(true);
  }

  // The people list = everyone with an account, plus the built-in starter
  // initials (TM/VC/RA/MT) so seed tasks keep their colors pre-signup.
  async function refreshPeople() {
    const { data } = await supabase.from("profiles").select("initials,name,color");
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
    let patch = null;
    if (action === "trash")    patch = { trashed: true };
    if (action === "complete") patch = { progress: 100, blocked: false };
    if (action === "block")    patch = { blocked: true };
    if (action === "unblock")  patch = { blocked: false };
    if (action === "archive")  patch = { archived: true, progress: 100, blocked: false };
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
    await supabase.from("projects").insert(cleanProject(data));
    loadProjects();
  }
  async function updateProject(u) {
    await supabase.from("projects").update(cleanProject(u)).eq("id", u.id);
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
    if (action === "trash") {
      await supabase.from("projects").update({ trashed: true }).in("id", ids);
      if (projView.name === "project" && ids.includes(projView.id)) setProjView({ name: "grid" });
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
        {PAGES.map(p => (
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
      <div className="subnav">Workspace &nbsp;/&nbsp; <b>{page}</b></div>

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
              onOpenTask={(id) => setTaskView({ name: "task", id, mode: "view" })}
              onAddTask={addTask}
              onBack={() => setProjView({ name: "grid" })}
              onUpdateProject={updateProject}
              onToggleStar={toggleTaskStar}
              onArchive={(id) => bulkTasks([id], "archive")}
              onTrashTask={trashTask}
            />
          ) : (
            <ProjectsPage
              projects={projects}
              tasks={tasks}
              trash={projTrash}
              onOpen={(id) => setProjView({ name: "project", id })}
              onAdd={addProject}
              onUpdate={updateProject}
              onStar={toggleProjectStar}
              onTrash={trashProject}
              onRecover={recoverProject}
              onPurge={purgeProject}
              onBulk={bulkProjects}
            />
          )
        )
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
