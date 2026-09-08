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
| [WEB-20](https://linear.app/jaymelworkspace/issue/WEB-20) | Filters on the account view | High |
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

Two of these have moved since they were written. **WEB-24** is half done: an
administrator can reset somebody's password from their page, and the reset ends
their open sessions; nobody can yet change their own. **WEB-27** named a screen
that no longer exists — My Day folded into a filter on the board — so the issue
needs restating against the board before it can be picked up.

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
designer covers Nike and Adidas; an Account Director carries three accounts. A
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
  person answerable for it. Working on Nike lets you move a card; it does not
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

**Tags stopped pretending to be clients.** "Nike" was a tag, recovered from a
task title with `CLIENTS.find(c => title.includes(c))`. It is a row now, with
an owner, a board and a roster. A tag says what *kind* of work something is —
`launch`, `monthly`, `reporting` — and nothing else.

**Needs Attention caps account slides at two.** With two teams, a
week-over-week slide could contribute at most two items. With five accounts —
and a department where a bad week moves most of them together — it filled all
four slots on `/overview` and buried both the weakest-work signal and every
person-level one. Five rows all saying "down a bit" is the trend chart again in
words, not a list of exceptions.

**Not done here:** campaigns, the per-account rail group, and the cross-account
My Tasks. The schema carries `campaigns` and `tasks.campaign_id` so the join is
already proved by a composite key; nothing reads them yet.

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
Sarah from Adidas leaves Nike and Coca-Cola alone.

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

**Boards are places, and an Account Director makes them.** This paragraph used
to say the opposite — "no user-created boards", no new-board button, no column
builder — and had been false for some time: `/boards/new`, board settings and a
column builder all exist. Recording the reversal rather than quietly deleting
the claim.

What changed is what a board is *for*. A board belongs to an account, which is
the thing the org chart already knows, so making one is naming a place a
client's work lives rather than configuring a workspace. What stays refused is
the part the brief was actually aiming at: there are no spaces, no folders over
boards, no per-board custom fields, and no arbitrary views. The list stays the
default — the brief says not to make Kanban the default interface.

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
