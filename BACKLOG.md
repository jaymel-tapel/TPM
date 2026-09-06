# Backlog

**The board is the source of truth:**
[Better Clickup on Linear](https://linear.app/jaymelworkspace/project/better-clickup-ea7c1d218c4e/overview)

Each issue there carries its own reasoning and its own definition of done. This
file is the index, plus the decisions that belong in the repo rather than on a
board.

**50 issues · 26 shipped · 24 outstanding**, labelled by epic: Foundation,
Auth and roles, Tasks, Team Member, Account Director, Senior Director,
Reporting, Quality.

---

## Outstanding, in the order worth doing them

### Missing rather than unfinished

| | | |
|---|---|---|
| [WEB-12](https://linear.app/jaymelworkspace/issue/WEB-12) | Test setup and first tests | Urgent |
| [WEB-13](https://linear.app/jaymelworkspace/issue/WEB-13) | CI pipeline | Urgent |
| [WEB-14](https://linear.app/jaymelworkspace/issue/WEB-14) | Delete confirmation on tasks | Urgent |
| [WEB-15](https://linear.app/jaymelworkspace/issue/WEB-15) | Loading and error states | Urgent |

There are zero tests, nothing stops a broken commit reaching `main`,
`deleteTask` fires on one click with no undo, and no route has a loading or
error boundary.

### Known debt

| | | |
|---|---|---|
| [WEB-16](https://linear.app/jaymelworkspace/issue/WEB-16) | Reports design pass | High |
| [WEB-17](https://linear.app/jaymelworkspace/issue/WEB-17) | Mobile and tablet | High |
| [WEB-18](https://linear.app/jaymelworkspace/issue/WEB-18) | Accessibility audit | High |
| [WEB-19](https://linear.app/jaymelworkspace/issue/WEB-19) | Rate-limit login | High |
| [WEB-22](https://linear.app/jaymelworkspace/issue/WEB-22) | N+1 query on the teams page | Medium |
| [WEB-23](https://linear.app/jaymelworkspace/issue/WEB-23) | Decide `/design` access before deploying | Medium |

### Brief features not yet built

| | | |
|---|---|---|
| [WEB-20](https://linear.app/jaymelworkspace/issue/WEB-20) | Filters on the team view | High |
| [WEB-21](https://linear.app/jaymelworkspace/issue/WEB-21) | Blocked state: capture the reason | High |
| [WEB-24](https://linear.app/jaymelworkspace/issue/WEB-24) | Password change | Medium |
| [WEB-25](https://linear.app/jaymelworkspace/issue/WEB-25) | Admin: user and team management | Medium |
| [WEB-26](https://linear.app/jaymelworkspace/issue/WEB-26) | Date range selector on reports | Medium |
| [WEB-27](https://linear.app/jaymelworkspace/issue/WEB-27) | Keyboard completion on My Day | Medium |
| [WEB-28](https://linear.app/jaymelworkspace/issue/WEB-28) | Optimistic task completion | Medium |
| [WEB-29](https://linear.app/jaymelworkspace/issue/WEB-29) | Assign work from the team view | Medium |
| [WEB-30](https://linear.app/jaymelworkspace/issue/WEB-30) | Needs Attention: mark as handled | Medium |
| [WEB-31](https://linear.app/jaymelworkspace/issue/WEB-31) | Session expiry UX | Low |
| [WEB-32](https://linear.app/jaymelworkspace/issue/WEB-32) | CSV export of reports | Low |
| [WEB-33](https://linear.app/jaymelworkspace/issue/WEB-33) | Comments on tasks | Low |
| [WEB-34](https://linear.app/jaymelworkspace/issue/WEB-34) | Activity history on tasks | Low |
| [WEB-35](https://linear.app/jaymelworkspace/issue/WEB-35) | Recurring tasks | Low |

---

## Decisions that stay decided

These are recorded here rather than on the board, because a board tracks work
and these are the absence of work.

### Not building

From the brief's own "Do Not Build" list: Gantt, docs, chat, whiteboards,
custom dashboards, custom fields, automations builder, nested spaces, folders,
project templates, arbitrary views, time tracking, workload forecasting.

Also no custom status builder and no task-type creation flow — task types are a
fixed set of six.

Contribution-level completion on collaborative tasks (Anna—Data, James—Slides)
is named in the brief as a *future extension* and is deliberately out of scope.

### Invariants worth not breaking

- **Completion is `completed_at`, never status alone.** Without it, "how did
  last Tuesday go?" has no answer. Stamped on the way into Done, cleared on the
  way out, in one function.
- **Overdue means carried over from an earlier day.** Work due today and
  unfinished is *remaining*. Conflating the two made every evening read as a
  crisis.
- **Tasks have no `assignee_id`.** Assignment is many-to-many through
  `task_assignees`, because one task can belong to several people.
- **`@meridian/ui` renders but never queries.** No Drizzle, no app routes, no
  clock. That boundary is what makes `/design` renderable from fixtures.
- **Every value cites a token.** See `DESIGN.md`. If a component is not on
  `/design`, it does not exist yet.
