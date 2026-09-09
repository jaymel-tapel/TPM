# Backlog

**The board is the source of truth:**
[Better Clickup on Linear](https://linear.app/jaymelworkspace/project/better-clickup-ea7c1d218c4e/overview)

Each issue there carries its own reasoning and its own definition of done. This
file is the index, plus the decisions that belong in the repo rather than on a
board.

**50 issues · 33 shipped · 17 outstanding**, labelled by epic: Foundation,
Auth and roles, Tasks, Team Member, Account Director, Senior Director,
Reporting, Quality.

---

## Outstanding, in the order worth doing them

### Known debt

| | | |
|---|---|---|
| [WEB-16](https://linear.app/jaymelworkspace/issue/WEB-16) | Reports design pass | High |
| [WEB-17](https://linear.app/jaymelworkspace/issue/WEB-17) | Mobile and tablet | High |
| [WEB-18](https://linear.app/jaymelworkspace/issue/WEB-18) | Accessibility audit | High |
| [WEB-19](https://linear.app/jaymelworkspace/issue/WEB-19) | Rate-limit login | High |
| [WEB-22](https://linear.app/jaymelworkspace/issue/WEB-22) | N+1 query on the accounts page | Medium |
| [WEB-23](https://linear.app/jaymelworkspace/issue/WEB-23) | Decide `/design` access before deploying | Medium |

### Brief features not yet built

| | | |
|---|---|---|
| [WEB-20](https://linear.app/jaymelworkspace/issue/WEB-20) | Filters — *done on an account's board; nowhere else* | Low |
| [WEB-21](https://linear.app/jaymelworkspace/issue/WEB-21) | Blocked state: capture the reason | High |
| [WEB-24](https://linear.app/jaymelworkspace/issue/WEB-24) | Password change — *self-service half* | Medium |
| [WEB-26](https://linear.app/jaymelworkspace/issue/WEB-26) | Date range selector on reports | Medium |
| [WEB-27](https://linear.app/jaymelworkspace/issue/WEB-27) | Keyboard completion — *restate: My Day is now a board filter* | Medium |
| [WEB-28](https://linear.app/jaymelworkspace/issue/WEB-28) | Optimistic task completion | Medium |
| [WEB-29](https://linear.app/jaymelworkspace/issue/WEB-29) | Assign work from the account view | Medium |
| [WEB-30](https://linear.app/jaymelworkspace/issue/WEB-30) | Needs Attention: mark as handled | Medium |
| [WEB-31](https://linear.app/jaymelworkspace/issue/WEB-31) | Session expiry UX | Low |
| [WEB-32](https://linear.app/jaymelworkspace/issue/WEB-32) | CSV export of reports | Low |
| [WEB-35](https://linear.app/jaymelworkspace/issue/WEB-35) | Recurring tasks | Low |

Three of these have moved since they were written. **WEB-20** is done where it
mattered: an account's board narrows by assignee, campaign, type, priority and
tag, in both its list and its columns, and every one of them is a link so a
narrowed board is a URL you can send. `FilterMenu` and `workFilterSql` are
written to serve any other screen that wants the same without changes. **WEB-24** is half done: an administrator can reset
somebody's password from their page, and the reset ends their open sessions;
nobody can yet change their own. **WEB-27** named a screen that no longer exists
— My Day folded into a filter on the board — so the issue needs restating
against the board before it can be picked up.

---

## Decisions that stay decided

These are recorded here rather than on the board, because a board tracks work
and these are the absence of work.

### Notifications, and why they came before chat

The brief lists notifications under *Nice to Have* and chat under *Do Not
Build*, and that ordering turned out to be right for a reason the brief does not
give. `@`-mentions shipped first, and for a while they notified nobody: the
mention was a styled span inside the BlockNote JSON and nothing else. The picker,
the chip and the link to the person's page all said "James now knows." He did
not. A feature that *looks* finished is worse than a missing one.

So the inbox is not a message centre. It answers one question — what still needs
me — from rows written when the thing happened: mentioned, assigned, commented.
No preferences, no digests, no channels, no email.

Two things are load-bearing:

- **A mentioned `userId` is a claim, not a fact.** It arrives inside a body the
  browser composed, so a hand-written payload can name anyone in the department.
  Every recipient goes through `filterUsersWhoCanSeeTask`, which must agree with
  `canViewTask` exactly — the test asserts them equal person by person. Without
  it, `@` becomes a way to push text at all thirty people and to leak another
  account's task titles.
- **The nudge carries nothing.** Ably delivers `{}`; the browser then re-renders
  on the server, past the same permission checks as a cold load. A channel
  misconfigured later leaks a wake-up, not content. The token is scoped to one
  channel, `subscribe` only, with the id taken from the session.

Real-time is a nicety, not a guarantee: with `ABLY_API_KEY` unset the rows are
still written and still read on the next navigation. That degradation is logged,
not silent.

### The migration numbers, and how two branches broke them

Two branches each generated an **0007** — folders on one, notifications on the
other. Resolved: folders kept `0007`/`0008` because Neon had already taken them,
and notifications was **regenerated** as `0009` on top, so its snapshot knows
folders exist. Hand-merging the two snapshots would have left a lineage neither
branch could generate from.

Worth keeping because the failure was silent, and would be again. `drizzle-kit
migrate` applies whatever is newer than the last applied record, by the `when`
timestamp in the journal rather than the file number. The notifications
migration carried an *earlier* timestamp than the folders pair that had already
run, so it was skipped and the command reported success. The `notifications`
table simply did not exist, and nothing said so.

Two branches generating migrations against one shared database is the setup
that produces this. If it happens again: regenerate the loser on top of the
winner rather than renumbering files, and check the table is actually there
rather than trusting the exit code.

### Accounts, and what happened to teams

The department stopped being two teams and became five clients, because the
brief's own shape did not survive contact with how an agency staffs work. A
designer covers Volvo and MG; an Account Director carries three accounts. A
`users.team_id` column can only ever tell one of those stories, and the product
was telling it — the roster, the board, the documents, the leave queue and
every permission read that one column.

So `teams` is `accounts`, and membership moved off the user row into
`account_members`. The rename is the smaller half. The half that matters is the
cardinality.

Four things are load-bearing:

- **A person's accounts are resolved once, onto the session.** Every predicate
  in `permissions.ts` used to be a synchronous comparison against a column;
  making it a table would have turned each one into a query. `getSession`
  resolves `accountIds` and `directedIds` the same way it already resolves
  `zone` and `hours`, and hands down a `Viewer`. The one permission that still
  costs a query is `assertCanViewUser`, because the accounts that matter there
  belong to the *target*, not the reader.
- **Membership is not directorship.** `canViewAccountWork` reads `accountIds` —
  everyone servicing the client. `canViewAccount` reads `directedIds` — the one
  person answerable for it. Working on Volvo lets you move a card; it does not
  let you invent the column it moves into, and it does not open the management
  rollup. Confusing the two is how the rail would start advertising doors the
  page shuts.
- **Leave is signed off by *a* director of an account you work on.** "Their own
  Account Director" named exactly one person only while people had one team.
  Now the chart has several edges into somebody, and the honest rule is that any
  director of an account they work on may settle it — whoever gets there first.
  An Account Director's own leave still goes up to the Senior Director, because
  asking a peer is asking sideways; nobody signs off their own at any level.
  The requester's accounts are passed into `canDecideLeave` rather than read
  inside it, because they are a fact about somebody who is not the viewer.
- **A null account still means the department's.** Board, task and document
  scoping all answer `accountId === null` *before* testing membership. Written
  the other way round, an empty `accountIds` would fall through to
  `includes(null)` and read as a refusal — the same trap the old code
  documented as `null === null` is not "same team".

Two smaller consequences, recorded so they are not re-litigated:

**Tags stopped pretending to be clients.** "Volvo" was a tag, recovered from a
task title with `CLIENTS.find(c => title.includes(c))`. It is a row now, with
an owner, a board and a roster. A tag says what *kind* of work something is —
`launch`, `monthly`, `reporting` — and nothing else.

**Needs Attention caps account slides at two.** With two teams, a
week-over-week slide could contribute at most two items. With five accounts —
and a department where a bad week moves most of them together — it filled all
four slots on `/overview` and buried both the weakest-work signal and every
person-level one. Five rows all saying "down a bit" is the trend chart again in
words, not a list of exceptions.

### One client hierarchy, and Board is not a place

The first cut of the account rail kept the Boards section beside it, so every
client's name appeared twice — once under Accounts and again under Boards, with
its board nested beneath. Two hierarchies describing one thing, and the second
one implied a board was somewhere you go.

It is not a place *beside* the client. A board is which set of columns that
client's work is drawn with, so it belongs **inside** the account: the rail
carries accounts, each opens into exactly four pages — Overview, Tasks,
Campaigns, Team — and Tasks opens once more into that account's boards. One
account is expanded at a time, because five expanded clients is a column you
scroll past to reach Docs.

**A client has more than one board**, because their pipelines do not share
stages: creative work moves through concepts and rounds, media work through
setup and optimisation, and forcing both into one set of columns is what makes
columns stop meaning anything. So the page is one board at a time — two boards
have two sets of columns and there is no honest way to draw both at once — and
**Board is a view mode** on it, next to List.

Three levels is one more than the rail had, and it is the only place it goes
that deep. Campaigns deliberately do not nest here: they are dated pushes
inside a client, they live on the Campaigns page, and putting them in the rail
would be the second hierarchy all over again.

Consequences worth stating:

- **A board is made inside a client, by whoever runs it.** Not from a Boards
  section, not for the department, and never by somebody who merely works on
  the account — `assertCanManageAccount`, the same rule that gates the columns.
  `renameBoard` and `deleteBoard` are gone: the name is only ever read inside
  the client it belongs to, and deleting a pipeline with work on it is not a
  button, it is a conversation.
- **Clicking a client both opens and navigates.** The name goes to its Overview
  and reveals the four pages; the chevron only reveals. A row that did one but
  not the other was the more surprising of the two options every time.
- **The parent row is never tinted.** Overview is one of the four children, so
  on an account's front page that child carries the active state. Marking the
  client's name as well would highlight two rows for one page and make the
  account read as a fifth destination alongside its own sections.
- **The rail shows three to five accounts**, ranked by the reader's *own* open
  work — the rail is a personal object — and always including the account being
  looked at, which takes the last slot rather than making it six. The rest are
  behind All Accounts.
- **Cross-account lists name the client on the row; an account's own list does
  not.** `TaskRowData.account` is set on My Tasks and Today and left off inside
  an account, where every row would repeat the page's own title.

**Three global items became one.** The rail carried Overview, Today and My
Tasks above the accounts, and two of them earned their place badly: My Tasks
was Today's four sections without the day plan, and Overview was All Accounts
with a hero on top. Today keeps the sections *and* the plan; the department
hero and the exceptions list moved onto All Accounts, above the rows they were
already describing. The Senior Director gets no Today at all — no work is
assigned to them, so it would open empty every morning — and their home is
Accounts.

**"All Accounts" is not a rail row.** It was a click past the list of clients
to reach a longer version of the same list, and for almost everybody the rail
already shows every account they have. It appears as a quiet "N more…" only
when the five-account cap is actually hiding something.

Campaigns are real now: three per client in the seed, matched to tasks by the
calendar rather than at random, so a campaign that ended in August cannot
contain work due in October. A campaign row shows two bars — delivery, and how
much of its own dates have gone — because "80% elapsed, 40% delivered" is the
thing worth noticing and neither number says it alone. A campaign with no work
filed against it shows a dash rather than `pct(0, 0)`'s 100%.

### Leave, and the line it does not cross

The brief's *Do Not Build* list carries **time tracking** and **workload
forecasting**, and leave sits close enough to both to be worth pinning down
before somebody assumes otherwise. Time tracking measures how long work took.
Forecasting predicts how much a person can absorb. Leave does neither: it
records a fact about a calendar day that somebody above them signed off, and
shows it beside the day.

**The invariant: leave says who is in, never how much they can take on.** No
leave query touches `tasks`. Nothing enters `queries/reports.ts`. A person's
completion percentage is *dimmed* on a day they were away rather than
recomputed, because a figure for a day they were not working is not a fact
about them — but it is the same figure the rollup counted, and completion keeps
exactly one definition. The moment a screen reads "Anna is at 60% capacity this
week because she is off Thursday", this has become forecasting.

The obvious next requests are on the far side of that line. An away marker in
the assignee picker is arguably fine; a warning when you assign work to someone
who is off is already advice; a capacity number is the thing the brief refuses,
and the slope between the three is short. Deferred, and named here while
deferring them costs nothing.

Three smaller decisions, so they are not re-derived:

- **Approval follows the org chart, not the role.** *Superseded in part — see
  "Accounts, and what happened to teams" above, which reworks the first half of
  this for people who work on several accounts.* A team member's leave is
  their own Account Director's; an Account Director's is the Senior Director's.
  The only rule added on top is that nobody signs off their own — which is what
  makes a director's request resolve to exactly one person without anywhere
  naming it as a special case. An approval nobody else makes is not an
  approval; it is a status field with extra steps. The Senior Director has
  nobody above them, so their leave is recorded as approved on filing with no
  decider, which is the honest row.
- **No notification, on purpose.** `notifications.task_id` is `NOT NULL` and
  the whole table is task-shaped, down to `InboxItemData` requiring a task
  title and `notify()` filtering recipients through `filterUsersWhoCanSeeTask`.
  Making it nullable means a discriminator, a rewritten inbox join, and a new
  recipient filter that has to agree with `canDecideLeave` the way the existing
  one agrees with `canViewTask` — a change to the one thing this file calls
  load-bearing, for an audience of three people. The pending count sits on the
  Team screen a director already opens every morning instead. The honest risk:
  an unread badge is what actually makes people act, so if approvals go stale,
  this is why.
- **A reason is withheld from teammates, in the SQL.** This feature is a real
  if small privacy expansion — before it a team member saw no roster at all,
  and after it they see their colleagues' names and dates. The dates are the
  point; the note is not. It is redacted in the query rather than in a
  component, because `@meridian/ui` renders what it is handed and a prop can be
  passed again somewhere else.

**Not built:** editing a filed request. Amending an approved range re-opens the
approval question, and the honest model for that is cancel-and-refile, which
already exists. Cancelling is allowed right up to the last day of the run and
does not go back to the approver, because a cancellation only ever hands time
back; leave already taken stays on the record.

### An account's numbers are the account's own business

Team members see each other's workload — the same per-person counts, bar and
percentage their Account Director reads.

This reverses the first cut, which showed them a roster with no numbers on it
at all. That was an over-reading of `canViewAccount`: the predicate exists to
keep the *management screen* to the people who manage — the completion headline
the department is judged on, Needs Attention, the leave queue, the right to
open somebody's day — and it was extended to mean a member should not know that
the colleague they share a task with is carrying seven overdue items. The
result was a row that said "In today", which the absence of an away badge said
already. It follows the rule the board and the documents already follow: the
accounts you work on, yes; across the org chart, no.

`canViewAccount` itself did not change in shape, only in what it compares — it
still refuses a team member, and its test still asserts so. What changed is
what sits behind it. A member's roster rows are still not links, because
`assertCanViewUser` still opens exactly one person's day for them — their own.

**This does not extend to leave notes.** "Why" stays redacted in SQL to the
filer and whoever decides it. Dates are a rota; a reason is not.

### The org chart is the Senior Director's alone

Accounts and people are editable now, at `/admin`, and only by the Senior
Director. Everything else is derived from that chart — which board a task can
be filed on, who may be assigned to it, who may be named in a description — so
an Account Director editing their own accounts' membership would be editing the
thing their own permissions are read from.

Two rules are enforced there rather than left to whoever fills the form in: a
Senior Director sits above the accounts and so is on none, and everybody else
is on **at least one**; and an account's Account Director has to be an Account
Director *working on that account*, which is the pairing `canViewAccount`
reads. Taking somebody off an account they ran clears that account's director
rather than leaving it pointing at somebody who left — per account, so dropping
Sarah from MG leaves Volvo and Kia alone.

**Nobody is deleted.** Nine tables reference `users.id` and most do not
cascade — tasks they wrote, documents they authored, comments they left — so a
delete would either take that work with it or fail at the database. Taking
somebody off their accounts is how they stop being given more, and the screen says so
rather than offering a button that errors. Real offboarding is a
`deactivated_at` column and a pass over every query; worth doing deliberately,
not smuggled in.

Passwords are generated, never chosen: minted server-side, returned in the
response that creates or resets the person rather than through a redirect, so
they are shown once and never reach a URL or a log. Only the hash is stored.

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

Folders are the part that most looks like what the brief refused, so be exact
about what they are. A folder holds; a document says something. Neither does
the other's job — the first cut let a document contain documents, which is the
model Notion uses and the one people trip over, because a thing you click to
read is also a thing that holds other things and "open" and "expand" end up
fighting over the same row. There is nothing to configure: a folder is a name
and a place, and the tree is a way of reading the list rather than a structure
you have to build before you can write anything.

Also no custom status builder and no task-type creation flow — task types are a
fixed set of six.

Contribution-level completion on collaborative tasks (Anna—Data, James—Slides)
is named in the brief as a *future extension* and is deliberately out of scope.

**No user-created boards** — true again, having been false for a while. The
claim originally stood, then `/boards/new`, board settings and a column builder
shipped and nothing updated this paragraph; the account rail then made a board
look like a second place a client lived. Both are undone: an account gets one
board when it is made, nobody creates another, and there is no Boards section.
See *"One client hierarchy, and Board is not a place"* above.

What survives is the part the brief always allowed: an Account Director names
the columns their client's work moves through, at `/accounts/[id]/columns`. No
spaces, no folders over boards, no per-board custom fields, no arbitrary views.
The list stays the default — the brief says not to make Kanban the default
interface.

### Invariants worth not breaking

- **Completion is `completed_at`, never status alone.** Without it, "how did
  last Tuesday go?" has no answer. Stamped on the way into Done, cleared on the
  way out, in one function.
- **Overdue means carried over from an earlier day.** Work due today and
  unfinished is *remaining*. Conflating the two made every evening read as a
  crisis.
- **Tasks have no `assignee_id`.** Assignment is many-to-many through
  `task_assignees`, because one task can belong to several people.
- **People have no `account_id`.** Membership is many-to-many through
  `account_members`, because one person works on several clients. The two are
  different questions: membership is who may see an account's work, assignment
  is whose work it is.
- **A composite key proves what a row claims.** A task's account matches its
  board's, its status belongs to its own board, and its campaign belongs to its
  own account — all three enforced by the database rather than by whoever wrote
  the action. Where a composite key lapses because a column is null, a check
  constraint closes it: department work has no client, so it cannot be part of
  a client's campaign.
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
  director publish to the whole department; an account's documents belong to
  the account, and anyone working on it may write them. That is deliberately
  *not* `canViewAccount`'s rule, which refuses team members outright — that
  rule is about reading across the org chart, this one is about writing inside
  an account you work on, and reusing it would have locked members out of their
  own runbooks.
  There is no per-document author check: a runbook only one person may correct
  is a runbook that goes stale.
- **Visibility belongs to the tree, not the row.** A folder is the
  department's or one account's, and everything inside takes its placement from
  it. Per-item visibility inside a tree makes holes: an account-only document in
  an org-wide folder is a gap in everyone else's tree and a broken breadcrumb, and
  the reverse publishes something reachable only by search. The scope is copied
  down the whole subtree on every move, and a check constraint on both tables
  keeps `visibility` and `account_id` from ever disagreeing.
- **A mention and an attachment are different rows.** `task_documents.source`
  is part of the key. Prose owns the links it makes and rewrites them on every
  save; the attach button owns its own. Neither can undo the other — otherwise
  deleting a sentence would detach a document somebody chose, and detaching one
  would be quietly undone by the next save.
- **Leave is displayed, never subtracted.** Completion is `completed_at`
  against `due_date`, and being on holiday does not remove a task from the
  denominator or change an account's percentage. The row quietens the number; it
  never recomputes it.
- **Reading a task and changing one are the same permission.** They used to
  differ — its author, an assignee or the account's director could edit,
  everyone else on it got a read-only panel — so a colleague looking at work in
  front of them had no way to correct a date they could see was wrong. An
  account's work belongs to the people servicing it, the same rule its
  documents follow. `canViewTask` still gates the page, so another account's
  task is still a 404. The consequence to know about: deleting follows the same
  rule, so anyone on the account can delete its task. It confirms first and names who else
  is on it, which is the check that matters there.
- **A board column is capped, never scrolled.** Done holds seventy cards on a
  fifteen-person roster. The count in the header is the real answer; the list
  view is where you read all of them.
- **A card dragged into place outranks priority — but only on the board.** A
  task carries a `position`, and the board sorts by it before falling back to
  priority and due date. Zero is not a rank; it means nobody has placed the
  card, and it sorts *after* everything placed, so a column no one has touched
  reads exactly as it always did and new work cannot land on top of an
  arrangement. Every other screen ignores `position` entirely: a list asks
  "what is urgent", and hand-ranking one board should not answer that question
  everywhere else.
- **A drop is woven into the column, never ranked against it.** The board never
  shows a column whole — twelve cards at most, and under a filter a scattered
  few — so the arrangement that comes back from a drag names only some of the
  cards. Ranking that list directly would pull those cards to the top and drop
  everything they were interleaved with behind them, silently, and only visible
  once the filter comes off and an arrangement somebody made by hand is gone.
  So the cards you could see keep the slots they occupied and only trade places
  with each other; a card nobody could see does not move, because nobody moved
  it. The cap alone was safe because what it hid was always a suffix — a filter
  is the first thing that makes the visible set sparse, which is the invariant
  that breaks.
- **A filter narrows the query, not the result.** The count in a column header
  has to count what is on the screen, or a board reading "19" over three cards
  is reporting on a board nobody is looking at.
- **The URL is the filter.** Type, priority and tag are search params on a
  server-rendered page, so a narrowed board is a link somebody can send and the
  back button does what it looks like it does. The same reason the docs search
  is a plain GET form.
- **A value that is not a value is dropped, not thrown on.** Filters arrive
  from a query string, and an unrecognised enum would reach Postgres as an
  invalid literal. A stale bookmark shows the whole board rather than an error
  page, and it is the query layer that guarantees it rather than each page.
- **Pieces have pieces, and only leaves are ever work.** Subtasks used to be
  one level, on the grounds that a tree is the nesting the brief is a reaction
  against. What actually makes nesting go wrong is a row that is both a thing
  you open and a thing that holds other things — the reason `documents` lost
  its `parent_id` in 0008. Tasks do not have that problem: the moment a task
  has children it stops counting itself and its children count instead, at
  every level, so a deeper tree says more about how work is arranged without
  changing what a day counts. A branch therefore has no completion of its own
  to report and derives one from what is under it; ticking it is refused.
  Depth stops at `MAX_SUBTASK_DEPTH`, which is a readability limit — past a
  handful of levels the indented rows run out of width — checked in
  `createSubtask` because Postgres cannot express a cross-row property without
  a trigger, and mirrored in the UI so no control is offered that the server
  would refuse.
