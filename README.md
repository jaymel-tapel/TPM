# Meridian

A daily operating system for a 30-person department. Built from
`task-management-system-handoff.md`.

> ClickUp optimises for flexibility. This system optimises for clarity.

The organisation's shape is fixed — one Senior Director, two Account Directors,
thirty people, five clients — so the product knows it rather than asking anyone
to configure it. There are no spaces, folders, custom views or dashboards to
build.

The unit everything hangs off is the **account**: a client the department works
for. People work on as many accounts as they work on — a designer covers Nike
and Adidas, an Account Director carries three — which is the one thing a
team-shaped product could not say.

---

## Workspace

```
meridian/
├── DESIGN.md              the design system we follow, and why
├── apps/
│   └── web/               @meridian/web — Next.js app, database, auth, queries
└── packages/
    └── ui/                @meridian/ui — design system: tokens + components
```

**The boundary that matters:** `@meridian/ui` renders, it never queries. It has
no dependency on Drizzle, the app's routes, or what time it is — everything
arrives as plain data through the contract in `packages/ui/src/types.ts`. The
app maps its rows onto that contract in `apps/web/src/lib/present.ts`.

That is what makes `/design` possible: the whole component library renders from
fixtures, with no database anywhere near it.

---

## Running it

Requires Node 20+, pnpm, and a local PostgreSQL.

```bash
pnpm install
createdb mb_tasks
cp apps/web/.env.example apps/web/.env.local   # then set AUTH_SECRET
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Seeding builds a deterministic 30-person department with three weeks of
history, so the reports and trends have something real to show. Every account
shares the password `demo1234`:

| Role | Email |
|---|---|
| Team Member | `anna.santos@meridian.co` |
| Account Director | `sarah.lim@meridian.co` |
| Senior Director | `elena.rivera@meridian.co` |

A dev-only **Viewing as** selector in the header switches between the three
levels from a single login. It is gated behind
`NEXT_PUBLIC_DEMO_ROLE_SWITCHER` and is not part of the production concept.

---

## Screens

| Route | | |
|---|---|---|
| `/design` | **Design system** | Every component, in every state. No auth required. |
| `/today` | **My Day** | What's left, what's done, one honest percentage. |
| `/boards`, `/boards/[id]` | Boards | An account's work as a list or a board. "My Tasks" is a filter on it, not a screen of its own. |
| `/accounts` | **Accounts** | Every client the reader works on, side by side. |
| `/accounts/[id]` | **Account** | One client in one screen. Its director gets the management view; anyone working on it gets the same roster without the management screen around it. |
| `/people/[id]` | Person | Anyone's day, for a director who can see them. |
| `/leave` | Leave | File for time off, and settle what is waiting on you. |
| `/overview` | **Department** | The Senior Director's hero, account comparison and exceptions. |
| `/reports` | Report | Six metrics and exactly one chart, one account at a time for a director. |
| `/docs`, `/chat` | Docs, Chat | Documents scoped to an account or the department; direct messages and groups. |
| `/tasks/new`, `/tasks/[id]` | Task | Eight fields. Nothing else to configure. |

---

## How completion is measured

Everything reports the same number, defined once in
`apps/web/src/queries/reports.ts`:

```
tasks due that day that were completed by end of that day
─────────────────────────────────────────────────────────
              total tasks due that day
```

Backlog never flatters today's figure. `completed_at` is the source of truth —
stamped when a task becomes done, cleared when it moves off — because status
alone cannot answer "how did last Tuesday go?".

**Overdue** means carried over from an earlier day. Work that is due today and
not finished is *remaining*, not overdue; otherwise every evening would read as
a crisis.

Days are bounded in a single timezone (`APP_TIMEZONE`, default `Asia/Manila`)
via `dayRange()` in `apps/web/src/lib/date.ts`, so the seed, the queries and the
UI can never disagree about where a day begins.

---

## Data model

`users`, `accounts`, `account_members`, `tasks`, `task_assignees`, `tags`,
`task_tags` — the brief's tables, with `teams` renamed to what it always
described and the membership taken off the user row.

**A person's accounts are a table, not a column.** `users.team_id` said
somebody worked for exactly one client, which is not how an agency staffs
anything; `account_members` says how many they actually work on. Two
consequences worth knowing: every permission reads that table rather than a
field, so the accounts are resolved once per request onto the session (`Viewer`
in `lib/auth.ts`) and every predicate stays a synchronous list check; and leave
is signed off by *a* director of an account you work on, because "your Account
Director" stopped naming exactly one person.

Assignment is many-to-many through `task_assignees`; there is deliberately no
`assignee_id` on `tasks`, because one task can belong to several people.
Completing a shared task completes it for everyone assigned. **Membership and
assignment are different questions** — belonging to Nike says you may see
Nike's work; being on a task says the work is yours.

`leave_requests` is the one table here the brief does not name. Its dates are
`date` columns rather than timestamps, which is the opposite choice to
`task_schedule` and deliberately so: a plan block is a moment on somebody's
clock, and two people in different zones may honestly disagree about whether a
task was late. Leave is the other case — "Anna is off on the 14th" has to be
true for her director in London and for her in Manila, or a rota is a rumour.

**Leave says who is in, never how much they can take on.** It does not enter
`queries/reports.ts`, does not adjust a completion rate and does not weight a
workload. A person's percentage is dimmed on a day they were away, because that
figure is not a fact about them — but it is the same number the rollup counted.
The moment a screen reads "Anna is at 60% capacity this week because she is off
Thursday", this has become the workload forecasting the brief refuses.

---

## Commands

```bash
pnpm dev          # run the app
pnpm build        # production build
pnpm typecheck    # both packages
pnpm db:seed      # rebuild the demo department
pnpm db:reset     # drop, migrate and reseed
```

### A build and a dev server share `.next`

`pnpm build` writes to `apps/web/.next`, which is the directory `pnpm dev` is
already serving from. Running a build while dev is up leaves the dev server
pointing at vendor chunks the build has deleted, and every page renders
unstyled with `Cannot find module './vendor-chunks/…'`.

`dev` therefore clears `.next` on every start, which costs about a second and
cannot affect a deployment. `build` stays the plain `next build`, because a
deploy runs that script and has to get what it expects.

What neither can fix: a dev server that was *already running* when a build
started is still pointing at deleted chunks. Stop dev before building, or
restart it after.
