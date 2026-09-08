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

From the brief's own "Do Not Build" list: Gantt, chat, whiteboards, custom
dashboards, custom fields, automations builder, project templates, arbitrary
views, time tracking, workload forecasting.

### Docs, reversed

The brief's "Do Not Build" list rules out docs, and nested spaces and folders
with them. That was right about what it was aiming at — a second product bolted
onto the first, with its own navigation to learn, which is the ClickUp failure
the whole brief is written against. It was not aiming at the thing the work
actually needs, which is somewhere to put the paragraph that would otherwise be
pasted into four task descriptions and then edited in three of them. A standing
instruction kept in a description is an instruction that exists once per task
and goes into the archive with it.

So: documents, but not a documents *product*. A title and a body, in the same
editor a description already uses, stored the same way in a text column. No
templates, no permissions matrix, no sharing links, no export, no versions. The
only thing that makes it worth building is the join to the work — attach one to
a task, type `@` in a description to name one, and read off the document which
tasks point at it.

Folders are the part that most looks like what the brief refused, so be exact:
there is no folder object. A document can be filed under another document,
which is the same nesting the rail already does for the org chart, and the tree
is a way of reading the list rather than a place to configure before anything
can be written.

Also no custom status builder and no task-type creation flow — task types are a
fixed set of six.

Contribution-level completion on collaborative tasks (Anna—Data, James—Slides)
is named in the brief as a *future extension* and is deliberately out of scope.

**No user-created boards.** A board exists per team and per person, derived
from the org chart that already exists — there is no "new board" button, no
board settings, and no column builder. Boards are a *view* over the day, which
the brief allows; boards as places work lives is the ClickUp failure the brief
was written against ("Users should not need to create dashboards, configure
views, build spaces, folders, or lists"). The list stays the default: the brief
says not to make Kanban the default interface.

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
- **A description is a BlockNote document stored as JSON in the same text
  column.** No migration: `toBlocks` accepts either JSON or prose, so rows
  written before the editor — and everything the seed writes — still open.
- **Object keys are minted by the server, never by the client.** A filename is
  user input; it lives in a column, not in a path. Everything a task holds is
  recorded in `task_attachments`, whether it was dropped into the prose or onto
  the list, so there is one lifecycle to delete and one place to count.
- **Writing a document follows the org chart, not ownership.** Both kinds of
  director publish to the whole department; a team's documents belong to the
  team, and anyone on it may write them. That is deliberately *not*
  `canViewTeam`'s rule, which refuses team members outright — that rule is
  about reading across the org chart, this one is about writing inside your own
  team, and reusing it would have locked members out of their own runbooks.
  There is no per-document author check: a runbook only one person may correct
  is a runbook that goes stale.
- **A document's visibility belongs to its subtree, not its row.** A document
  is the department's or one team's, and one filed under another is whatever
  its parent is. Per-document visibility inside a tree makes holes: a team-only
  child under an org-wide parent is a gap in everyone else's tree and a broken
  breadcrumb, and the reverse publishes something reachable only by search. The
  scope is copied down the whole subtree on every move, and the check
  constraint keeps `visibility` and `team_id` from ever disagreeing.
- **A mention and an attachment are different rows.** `task_documents.source`
  is part of the key. Prose owns the links it makes and rewrites them on every
  save; the attach button owns its own. Neither can undo the other — otherwise
  deleting a sentence would detach a document somebody chose, and detaching one
  would be quietly undone by the next save.
- **A board column is capped, never scrolled.** Done holds seventy cards on a
  fifteen-person team. The count in the header is the real answer; the list
  view is where you read all of them.
