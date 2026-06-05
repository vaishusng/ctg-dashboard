import { useEffect, useState } from "react";
import Login from "./Login.jsx";
import HomePage from "./HomePage.jsx";
import Board from "./Board.jsx";
import ProjectsPage from "./ProjectsPage.jsx";
import ProjectDetail from "./ProjectDetail.jsx";
import ChatPage from "./ChatPage.jsx";
import TaskDetail from "./TaskDetail.jsx";
import ProfilePage from "./ProfilePage.jsx";
import { SEED, SEED_PROJECTS, DEFAULT_PEOPLE, applyDrop } from "./data.js";

// ---------------------------------------------------------------------------
// App = the brain. Pages: Home, Tasks, Projects (grid -> project detail),
// Team Chat, and Profile.
// Archived tasks STAY in the tasks list with archived: true — they're hidden
// from the board but still count toward project progress (finished work is
// still work).
// ---------------------------------------------------------------------------

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
// Stage merge (per Madhavi): "Review" is now part of "Approval".
// Also normalizes tasks saved by older versions of the app so missing
// fields can never crash a newer screen.
function migrateStages(list) {
  if (!Array.isArray(list)) return [];
  return list.map(t => ({
    ...t,
    stage: t.stage === "Review" ? "Approval" : t.stage,
    assignees: Array.isArray(t.assignees) ? t.assignees : [],
    comments: Array.isArray(t.comments) ? t.comments : [],
    progress: Number(t.progress) || 0,
    hours: Number(t.hours) || 0,
  }));
}
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem("ctg_accounts")) || []; }
  catch { return []; }
}
function saveAccounts(accounts) {
  localStorage.setItem("ctg_accounts", JSON.stringify(accounts));
}

const PAGES = ["Home", "Projects", "Tasks", "Team Chat"];

export default function App() {
  const [user, setUser] = useState(() => load("ctg_user", null));
  const [people, setPeople] = useState(() => load("ctg_people2", DEFAULT_PEOPLE));
  const [tasks, setTasks] = useState(() => migrateStages(load("ctg_tasks2", SEED)));
  const [trash, setTrash] = useState(() => migrateStages(load("ctg_trash2", [])));
  const [projects, setProjects] = useState(() => load("ctg_projects3", SEED_PROJECTS));
  const [projTrash, setProjTrash] = useState(() => load("ctg_projects_trash2", []));
  const [messages, setMessages] = useState(() => load("ctg_messages", []));
  const [chatCleared, setChatCleared] = useState(() => load("ctg_chat_cleared", {}));

  const [page, setPage] = useState("Home");
  const [taskView, setTaskView] = useState({ name: "board" });
  const [projView, setProjView] = useState({ name: "grid" });

  useEffect(() => { localStorage.setItem("ctg_people2", JSON.stringify(people)); }, [people]);
  useEffect(() => { localStorage.setItem("ctg_tasks2", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("ctg_trash2", JSON.stringify(trash)); }, [trash]);
  useEffect(() => { localStorage.setItem("ctg_projects3", JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem("ctg_projects_trash2", JSON.stringify(projTrash)); }, [projTrash]);
  useEffect(() => { localStorage.setItem("ctg_messages", JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem("ctg_chat_cleared", JSON.stringify(chatCleared)); }, [chatCleared]);
  useEffect(() => {
    if (user) localStorage.setItem("ctg_user", JSON.stringify(user));
    else localStorage.removeItem("ctg_user");
  }, [user]);

  const firstName = (u) => (u.nickname || u.name.split(" ")[0]);

  // ---- auth ----
  function handleAuth(account) {
    setPeople(prev =>
      prev.some(p => p.initials === account.initials)
        ? prev
        : [...prev, { initials: account.initials, name: account.name, color: account.color }]
    );
    setUser({
      name: account.name,
      nickname: account.nickname || "",
      email: account.email,
      initials: account.initials,
      color: account.color,
    });
    setPage("Home");
  }

  // ---- profile ----
  function saveProfile({ name, nickname, email, color }) {
    const emailNorm = email.trim().toLowerCase();
    if (!name.trim() || !emailNorm) return "Name and email can't be empty.";
    const nick = nickname.trim().split(/\s+/)[0] || "";
    const accounts = loadAccounts();
    if (accounts.some(a => a.email === emailNorm && a.email !== user.email))
      return "That email is already used by another account.";
    const idx = accounts.findIndex(a => a.email === user.email);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], name: name.trim(), nickname: nick, email: emailNorm, color };
      saveAccounts(accounts);
    }
    setPeople(prev => prev.map(p =>
      p.initials === user.initials ? { ...p, name: name.trim(), color } : p
    ));
    setUser({ ...user, name: name.trim(), nickname: nick, email: emailNorm, color });
    return null;
  }

  function changePassword(oldPw, newPw) {
    const accounts = loadAccounts();
    const idx = accounts.findIndex(a => a.email === user.email);
    if (idx < 0 || accounts[idx].password !== oldPw) return "Old password doesn't match.";
    accounts[idx].password = newPw;
    saveAccounts(accounts);
    return null;
  }

  // ---- task operations ----
  const nextTaskId = () => Math.max(0, ...tasks.map(t => t.id), ...trash.map(t => t.id)) + 1;
  const addTask = (data) => setTasks(prev => [...prev, { ...data, id: nextTaskId() }]);
  const updateTask = (u) => setTasks(prev => prev.map(t => (t.id === u.id ? u : t)));
  const dropTask = (id, col) => setTasks(prev => prev.map(t => (t.id === id ? applyDrop(t, col) : t)));
  const toggleTaskStar = (id) => setTasks(prev => prev.map(t => (t.id === id ? { ...t, starred: !t.starred } : t)));
  const unarchiveTask = (id) => setTasks(prev => prev.map(t => (t.id === id ? { ...t, archived: false } : t)));
  function trashTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    setTrash(prev => [...prev, t]);
    setTasks(prev => prev.filter(x => x.id !== id));
    if (taskView.name === "task" && taskView.id === id) setTaskView({ name: "board" });
  }
  function recoverTask(id) {
    const t = trash.find(x => x.id === id);
    if (!t) return;
    setTasks(prev => [...prev, t]);
    setTrash(prev => prev.filter(x => x.id !== id));
  }
  const purgeTask = (id) => setTrash(prev => prev.filter(x => x.id !== id));

  // Bulk actions for the Select mode (and single archive uses it too).
  function bulkTasks(ids, action) {
    const idSet = new Set(ids);
    if (action === "trash") {
      const moving = tasks.filter(t => idSet.has(t.id));
      setTrash(prev => [...prev, ...moving]);
      setTasks(prev => prev.filter(t => !idSet.has(t.id)));
      if (taskView.name === "task" && idSet.has(taskView.id)) setTaskView({ name: "board" });
      return;
    }
    setTasks(prev => prev.map(t => {
      if (!idSet.has(t.id)) return t;
      if (action === "complete") return { ...t, progress: 100, blocked: false };
      if (action === "block") return { ...t, blocked: true };
      if (action === "unblock") return { ...t, blocked: false };
      if (action === "archive") return { ...t, archived: true, progress: 100, blocked: false };
      return t;
    }));
  }

  // ---- task comments (the per-task updates feed) ----
  function addTaskComment(taskId, text) {
    if (!text.trim()) return;
    const comment = {
      id: Date.now(),
      author: firstName(user),
      initials: user.initials,
      color: user.color,
      text: text.trim(),
      ts: new Date().toISOString(),
    };
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, comments: [...(t.comments || []), comment] } : t
    ));
  }
  function editTaskComment(taskId, commentId, text) {
    if (!text.trim()) return;
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, comments: (t.comments || []).map(c => c.id === commentId ? { ...c, text: text.trim(), edited: true } : c) }
        : t
    ));
  }
  function deleteTaskComment(taskId, commentId) {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, comments: (t.comments || []).filter(c => c.id !== commentId) }
        : t
    ));
  }

  // ---- project operations ----
  const nextProjId = () => Math.max(0, ...projects.map(p => p.id), ...projTrash.map(p => p.id)) + 1;
  const addProject = (data) => setProjects(prev => [...prev, { ...data, id: nextProjId() }]);
  const updateProject = (u) => setProjects(prev => prev.map(p => (p.id === u.id ? u : p)));
  const toggleProjectStar = (id) => setProjects(prev => prev.map(p => (p.id === id ? { ...p, starred: !p.starred } : p)));
  function trashProject(id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    setProjTrash(prev => [...prev, p]);
    setProjects(prev => prev.filter(x => x.id !== id));
    if (projView.name === "project" && projView.id === id) setProjView({ name: "grid" });
  }
  function recoverProject(id) {
    const p = projTrash.find(x => x.id === id);
    if (!p) return;
    setProjects(prev => [...prev, p]);
    setProjTrash(prev => prev.filter(x => x.id !== id));
  }
  const purgeProject = (id) => setProjTrash(prev => prev.filter(x => x.id !== id));

  function bulkProjects(ids, action) {
    const idSet = new Set(ids);
    if (action === "trash") {
      const moving = projects.filter(p => idSet.has(p.id));
      setProjTrash(prev => [...prev, ...moving]);
      setProjects(prev => prev.filter(p => !idSet.has(p.id)));
      if (projView.name === "project" && idSet.has(projView.id)) setProjView({ name: "grid" });
      return;
    }
    if (action === "done") {
      setProjects(prev => prev.map(p =>
        idSet.has(p.id) ? { ...p, auto: false, progress: 100 } : p
      ));
    }
  }

  // ---- chat ----
  function sendMessage(text) {
    if (!text.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      author: firstName(user),
      initials: user.initials,
      color: user.color,
      text: text.trim(),
      ts: new Date().toISOString(),
    }]);
  }
  function editMessage(id, text) {
    if (!text.trim()) return;
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, text: text.trim(), edited: true } : m)));
  }
  function deleteMessage(id) {
    setMessages(prev => prev.filter(m => m.id !== id));
  }
  function clearChat() {
    setChatCleared(prev => ({ ...prev, [user.initials]: new Date().toISOString() }));
  }

  if (!user) return <Login onAuth={handleAuth} />;

  const clearedAt = chatCleared[user.initials] || "";
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
        <button className="btn btn-ghost" onClick={() => setUser(null)}>Log out</button>
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
