# Meridian

A daily operating system for a 30-person department. Built from
`task-management-system-handoff.md`.

> ClickUp optimises for flexibility. This system optimises for clarity.

The organisation's shape is fixed — one Senior Director, two Account Directors,
~15 people per team — so the product knows it rather than asking anyone to
configure it. There are no spaces, folders, custom views or dashboards to build.

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
| `/my-tasks` | My Tasks | Everything open plus today's completions, with compact filters. |
| `/team` | **Team Today** | An Account Director's team in one screen. |
| `/team/[id]` | Person | Anyone's day, for a director who can see them. |
| `/overview` | **Department** | The Senior Director's hero, team comparison and exceptions. |
| `/teams` | Teams | Both teams side by side. |
| `/reports` | Report | Six metrics and exactly one chart. |
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

`users`, `teams`, `tasks`, `task_assignees`, `tags`, `task_tags` — the tables
the brief names, and no others. Assignment is many-to-many through
`task_assignees`; there is deliberately no `assignee_id` on `tasks`, because one
task can belong to several people. Completing a shared task completes it for
everyone assigned.

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

`build` clears `.next` first so the *build* is always clean, but that does not
rescue a dev server that was running at the time. Stop dev before building, or
restart it afterwards.
