# Backlog

Every functional area of the product as a ticket. Grouped into epics; each
ticket is sized to be picked up on its own.

`DONE` — shipped and verified · `TODO` — not started · `PARTIAL` — exists but incomplete

---

## Epic 1 · Foundation

| # | Ticket | Status |
|---|---|---|
| F-1 | pnpm monorepo: `apps/web` + `packages/ui` | DONE |
| F-2 | Design system on Geist — tokens, type ramp, 4pt grid (`DESIGN.md`) | DONE |
| F-3 | Component gallery at `/design`, every component in every state | DONE |
| F-4 | Postgres schema + Drizzle migrations (6 tables, no `assignee_id` on tasks) | DONE |
| F-5 | Deterministic seed: 30 people, 3 weeks of history | DONE |
| F-6 | Presentation adapter keeping the DB out of `@meridian/ui` | DONE |

### F-7 · CI pipeline — TODO
GitHub Actions running `pnpm typecheck` and `pnpm build` on every push and PR.
Nothing currently stops a broken commit landing on `main`.
**Done when:** a PR with a type error shows a red check.

### F-8 · Test setup and first tests — TODO
There are zero tests. Highest-value targets, in order:
1. `completionRate` / `onTime` SQL — the definition every screen depends on
2. `dayRange` / `startOfAppDay` timezone boundaries
3. `toTaskRow` overdue logic (carried-over vs remaining)
4. Permission guards: AD cannot read another team

**Done when:** `pnpm test` runs in CI and covers the four above.

---

## Epic 2 · Authentication & roles

| # | Ticket | Status |
|---|---|---|
| A-1 | Email + password login, bcrypt, signed JWT cookie | DONE |
| A-2 | Middleware gate + graceful stale-session handling | DONE |
| A-3 | Role-derived navigation (`navFor`) | DONE |
| A-4 | Permission guards on every query (`assertCanViewUser` / `Team` / `Reports`) | DONE |
| A-5 | Demo "Viewing as" role switcher, env-gated | DONE |

### A-6 · Password change — TODO
No way to change a password. Every seeded account shares `demo1234`.
**Done when:** a signed-in user can change their own password; the old one stops working.

### A-7 · Admin user & team management — TODO
Users and teams exist only via the seed. A real deployment needs a way to add a
joiner, move someone between teams, or reassign an Account Director.
**Done when:** a Senior Director can create a user, set their role and team, and deactivate them.

### A-8 · Session expiry UX — TODO
The cookie lasts 7 days and simply stops working. A mid-edit expiry loses the form.
**Done when:** an expired session returns to login and back to the page you were on.

---

## Epic 3 · Tasks

| # | Ticket | Status |
|---|---|---|
| T-1 | Create task — 8 fields, no more | DONE |
| T-2 | Edit task | DONE |
| T-3 | Multiple assignees (many-to-many); completing a shared task completes it for all | DONE |
| T-4 | Due date, task type, priority, tags | DONE |
| T-5 | Status: To Do / In Progress / Done | DONE |
| T-6 | One-click complete from any task row | DONE |
| T-7 | `completed_at` stamped in, cleared out — the reporting invariant | DONE |

### T-8 · Delete confirmation — TODO
`deleteTask` fires on a single click with no confirmation and no undo. It is the
only destructive action in the product and the easiest to hit by accident.
**Done when:** deleting asks first, and says what will be lost for a shared task.

### T-9 · Blocked state, properly — PARTIAL
`blocked` exists in the enum, is settable on task detail, and surfaces in Needs
Attention. What is missing is the reason: a blocked task cannot say what it is
waiting on, so a director sees the flag without the cause.
**Done when:** setting Blocked asks for a short reason, shown wherever the task appears.

### T-10 · Comments — TODO
Nice-to-have in the brief. The most common reason work stalls is a question
nobody can see.
**Done when:** a task has a comment thread; commenters are visible on the task.

### T-11 · Activity history — TODO
Nice-to-have in the brief. `task_activity` was designed for and left out.
**Done when:** the task detail shows who changed status, assignees or due date, and when.

### T-12 · Recurring tasks — TODO
Nice-to-have. Weekly meeting notes are seeded as separate rows today.
**Done when:** a task can repeat daily/weekly and generates the next instance on completion.

---

## Epic 4 · Team Member

| # | Ticket | Status |
|---|---|---|
| M-1 | My Day: Today / Completed / Carried over, one honest percentage | DONE |
| M-2 | My Tasks with compact filter chips | DONE |
| M-3 | Task detail / create screens | DONE |

### M-4 · Keyboard completion on My Day — TODO
Completing tasks is mouse-only. This is the screen people use most, every day.
**Done when:** arrow keys move between tasks and a key completes the focused one.

### M-5 · Optimistic completion — TODO
Ticking a task round-trips to the server before the row moves, which feels slow
on a list of six.
**Done when:** the row moves immediately and reconciles, or rolls back on failure.

---

## Epic 5 · Account Director

| # | Ticket | Status |
|---|---|---|
| D-1 | Team Today: headline rate, per-person rows, Needs Attention | DONE |
| D-2 | Person drilldown — anyone on their team | DONE |
| D-3 | Cross-team access refused as 404 | DONE |

### D-4 · Filters on the team view — TODO
The brief lists Person / Status / Task Type / Priority / Date / Tag for Team and
Reports. `listTasks` supports all of them and `/my-tasks` exposes them; the team
view exposes none.
**Done when:** the same chips work on the team view, including the person filter.

### D-5 · Assign work from the team view — TODO
An Account Director looking at someone who is behind has to leave for the new
task form and pick the person again.
**Done when:** a member row can start a task pre-assigned to that person.

---

## Epic 6 · Senior Director

| # | Ticket | Status |
|---|---|---|
| S-1 | Department hero — navy, completion rate, week-over-week delta | DONE |
| S-2 | 7-day trend strip, zoomed to the data and labelled as such | DONE |
| S-3 | Team comparison on one shared axis | DONE |
| S-4 | Department Needs Attention — trend, weakest task type, worst offenders | DONE |
| S-5 | Teams list and drilldown into either team | DONE |

### S-6 · Needs Attention: mark as handled — TODO
Signals reappear every day with no way to say "I have dealt with this", so the
section slowly becomes wallpaper.
**Done when:** an item can be snoozed or dismissed for a period, and says who did it.

---

## Epic 7 · Reporting

| # | Ticket | Status |
|---|---|---|
| R-1 | Completion rate defined once — due that day, done by end of that day | DONE |
| R-2 | Six headline metrics | DONE |
| R-3 | Daily completion chart | DONE |
| R-4 | Completion by task type, workload per person | DONE |
| R-5 | Overdue as carried-over, not past-its-clock-time | DONE |

### R-6 · Report design pass — TODO
The Reports screen was ported onto the design system rather than designed on it.
It is the weakest screen. The metric band, chart card and two breakdown lists
need the treatment Overview just had.
**Done when:** Reports reads as deliberately as `/overview`.

### R-7 · Date range selector — TODO
Every report is hard-coded to 7 days. "How did last month go?" cannot be asked.
**Done when:** 7 / 30 / 90 days and a custom range, reflected in the URL.

### R-8 · Export — TODO
No way to get numbers out for a deck or a review.
**Done when:** the current report downloads as CSV with the filters applied.

---

## Epic 8 · Quality & hardening

### Q-1 · Loading and error states — TODO
Zero `loading.tsx` or `error.tsx` files. Every screen is `force-dynamic` and
blocks on its queries; a failed query shows the raw Next error page.
**Done when:** each route has a skeleton and a recoverable error boundary.

### Q-2 · Mobile and tablet — TODO
Built desktop-first per the brief and never checked below `lg`. The team roster
and comparison rows in particular collapse in ways nobody has looked at.
**Done when:** every screen is usable at 390px and 768px.

### Q-3 · Accessibility audit — TODO
Never audited. Known suspects: the status toggle is a bare submit button, the
"Viewing as" select has a `sr-only` label pattern used inconsistently, focus
order through task rows is untested, and colour-only signals need checking.
**Done when:** keyboard-only completion of the core flows, and axe reports no
serious violations.

### Q-4 · N+1 on the teams page — TODO
`/teams` calls `getTeamToday` once per team, each running three subqueries. Fine
at two teams, wrong in shape.
**Done when:** one query returns both rosters.

### Q-5 · Rate-limit login — TODO
`login` has no throttling; passwords can be guessed as fast as requests arrive.
**Done when:** repeated failures for an address back off.

### Q-6 · Decide `/design` access — TODO
The gallery is deliberately unauthenticated so it renders from fixtures. Fine
locally; a decision is needed before anything is deployed.
**Done when:** it is either behind auth in production or consciously left public.

---

## Not building

From the brief's "Do Not Build" list, recorded so they stay decided rather than
forgotten: Gantt, docs, chat, whiteboards, custom dashboards, custom fields,
automations builder, nested spaces, folders, project templates, arbitrary views,
time tracking, workload forecasting. Also no custom status builder and no
task-type creation flow.

Contribution-level completion on collaborative tasks (Anna—Data, James—Slides)
is described in the brief as a future extension and is explicitly out of scope.
