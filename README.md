# CTG Task Dashboard

A task-management website built for Catalyst Technical Group (CTG), a civil
engineering firm in Houston, TX. Built during a summer internship.

Tasks live on a four-column board (Not Started / In Progress / Completed /
Blocked). Cards are **click-to-open** and **drag-and-drop**. A task's column
is driven by its progress: 0% = Not Started, 1–99% = In Progress,
100% = Completed; "Blocked" is set manually for work stuck waiting on
counties, health departments, or clients.

**Stack:** React (Vite) · Supabase (auth + database, coming) · Vercel (hosting, coming)

---

## Run it on your Mac

1. **Install Node** (one time only). Download the LTS version from
   https://nodejs.org and run the installer. Check it worked:
   ```
   node -v
   ```
2. **Install the project's packages** (one time, inside this folder):
   ```
   npm install
   ```
3. **Start the app:**
   ```
   npm run dev
   ```
   Open the link it prints (usually http://localhost:5173).
4. **Sign up** with any email + password and the employee code `CTG-2026`
   (change the code in `src/data.js`).

To stop the app: press `Ctrl+C` in Terminal.

---

## Put it on GitHub

From inside this folder:

```
git init
git add .
git commit -m "CTG task dashboard - React version"
```

Then create an empty repo on github.com (e.g. `ctg-dashboard`), and:

```
git remote add origin https://github.com/YOUR_USERNAME/ctg-dashboard.git
git branch -M main
git push -u origin main
```

After that, every time you change something:

```
git add .
git commit -m "describe what you changed"
git push
```

---

## Project map

```
index.html          fonts + the page the app loads into
src/main.jsx        starts React
src/data.js         ⭐ stages, people, employee code, sample tasks — edit me
src/App.jsx         logged-in user, tasks, trash, which screen is showing
src/Login.jsx       Screen 1 — login / signup (employee code required)
src/Board.jsx       Screen 2 — board, filters, sort, search, add-task, trash
src/TaskCard.jsx    one draggable, clickable card
src/TaskDetail.jsx  Screen 3 — read-only view + edit mode
src/styles.css      all styling
```

## Current status / roadmap

- [x] v1 — full app running locally. Data + accounts are saved in the
      browser (localStorage), so they survive refreshes but are **per
      computer** and **not yet secure**.
- [ ] v2 — **Supabase**: real authentication (safe password storage), **email
      password recovery**, and a
      shared database so the whole team sees the same board.
- [ ] v3 — **Vercel**: deploy to a live link for CTG.
