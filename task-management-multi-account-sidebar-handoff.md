# Task Management Platform — Multi-Account Sidebar Handoff

## Goal

Update the current task management prototype so users can work across multiple client accounts without being locked into a single team or workspace.

The product is for a marketing agency, so the main organizational object should be the **Account / Client**.

A user can belong to multiple accounts.

Examples:

- An Account Director may manage Nike, Adidas, and Coca-Cola
- A Designer may work across Nike and Adidas
- A Copywriter may only work on Nike
- A Senior Director may have visibility across all accounts

The sidebar should make this structure immediately understandable.

---

# Core Product Model

Do not assume:

```text
User
→ Team
→ Account
```

That is too restrictive for agency work.

Instead use:

```text
User
↕
Account Membership
↕
Account
```

Each user may have multiple account memberships.

Example:

```text
Sarah Johnson
├── Nike
│   └── Account Director
├── Adidas
│   └── Account Director
└── Coca-Cola
    └── Account Director
```

Another user:

```text
Anna Santos
├── Nike
│   └── Designer
└── Adidas
    └── Designer
```

This allows shared people/resources across different clients.

---

# New Sidebar

Replace the current board-oriented navigation with:

```text
MB Advertising

Overview
Today
My Tasks

ACCOUNTS
  All Accounts

▾ Nike
   Overview
   Tasks
   Campaigns
   Team

▸ Adidas
▸ Coca-Cola

People
Reports

Chat
Docs

────────────────

Notifications
Sign out

Anna Santos
Account Director
```

---

# Main Sidebar Principle

There are two navigation levels.

## Global Navigation

These views work across all accounts the user has access to:

```text
Overview
Today
My Tasks
People
Reports
```

## Account Navigation

Each account acts as its own expandable workspace:

```text
Nike
├── Overview
├── Tasks
├── Campaigns
└── Team
```

Do not use horizontal account tabs anymore.

The account submenu should live directly inside the sidebar.

---

# Account Expansion Behavior

Only one account should be expanded at a time.

Example:

```text
ACCOUNTS
  All Accounts

▸ Adidas

▾ Nike
   Overview
   Tasks
   Campaigns
   Team

▸ Coca-Cola
```

If Adidas is opened, collapse Nike.

This prevents the sidebar from becoming too tall or visually noisy.

---

# Accounts Shown in Sidebar

Do not show every account if the user has many.

Show approximately 3–5 assigned or recently accessed accounts.

Example:

```text
ACCOUNTS
  All Accounts

▾ Nike
   Overview
   Tasks
   Campaigns
   Team

▸ Adidas
▸ Cortado
▸ Coca-Cola
```

`All Accounts` opens the complete account list.

---

# Role-Based Account Visibility

The accounts shown in the sidebar should depend on access.

## Team Member

Only show accounts they belong to.

Example:

```text
ACCOUNTS
  All Accounts

▸ Nike
▸ Adidas
```

## Account Director

Show all accounts they manage.

Example:

```text
ACCOUNTS
  All Accounts

▸ Nike
▸ Adidas
▸ Coca-Cola
```

## Senior Director

Can access all department accounts.

---

# Account Submenu

Every account should have exactly four primary sections:

```text
Overview
Tasks
Campaigns
Team
```

Avoid adding more unless absolutely necessary.

---

# Account → Overview

Purpose:

> What is happening with this client right now?

Example:

```text
Nike

Account Director
Sarah Johnson

12 tasks today

9 completed

2 overdue

1 blocked
```

Then:

```text
Active Campaigns

Summer Launch
78% complete
3 tasks due this week

Always-On Social
92% complete
On track

Nike Run Club
64% complete
2 overdue
```

Add a small:

```text
Needs Attention
```

Example:

```text
2 overdue tasks

Summer Launch
1 blocked task

John Cruz
6 tasks due today
```

Keep this lightweight.

Do not create an analytics-heavy dashboard.

---

# Account → Tasks

Reuse the existing task board UI.

Do not create a separate task system.

Example page:

```text
Nike
Tasks

[ All Campaigns ▾ ]
[ All People ▾ ]
[ Task Type ▾ ]

[List] [Board]
```

Board statuses:

```text
TO DO
IN PROGRESS
BLOCKED
DONE
```

The account is already known from the current page, so do not repeat the account name on every task card.

---

# Account → Campaigns

Campaigns should remain lightweight organizational containers.

Example:

```text
Summer Launch

May 12 – June 30

78%

14 / 18 tasks completed

3 due
1 overdue
```

Campaigns should not become:

```text
Workspace
→ Folder
→ Project
→ List
→ Sub-list
→ Task
```

Keep the hierarchy shallow.

A campaign mainly provides context and task filtering.

---

# Account → Team

Show all people assigned to this account.

Example:

```text
Nike Team

Anna Santos
Designer
4 / 5 complete
80%

John Cruz
Copywriter
3 / 7 complete
43%
2 overdue

Maria Reyes
Paid Media
6 / 6 complete
100%
```

A person may appear in multiple account teams.

That is expected.

Do not treat account membership as exclusive.

---

# My Tasks

`My Tasks` is extremely important in this multi-account model.

It should give one unified execution view across all accounts.

Example:

```text
My Tasks

TODAY

Nike
Design campaign carousel

Adidas
Revise landing page

Nike
Review social assets

Coca-Cola
Prepare performance report
```

This solves the problem of people working across several clients.

They should not need to manually open every account to discover what they need to do.

---

# My Tasks Filters

Allow:

```text
[ All Accounts ▾ ]
[ All Statuses ▾ ]
[ Task Type ▾ ]
```

Optional sections:

```text
Today
Upcoming
Overdue
Completed
```

---

# Today

`Today` should also work across accounts.

Purpose:

> What needs attention today?

Example:

```text
Today

8 tasks due
5 completed
2 in progress
1 blocked

[ All Accounts ▾ ]
[ My Tasks ▾ ]
```

Tasks can be grouped visually by account.

Example:

```text
NIKE

Review landing page
Design social carousel

ADIDAS

Approve campaign copy

COCA-COLA

Performance report
```

---

# Global Overview

Overview should summarize everything the current user is responsible for.

## Team Member

```text
Good morning, Anna

Your Day

8 tasks today
5 completed
2 in progress
1 remaining

Accounts

Nike
4 tasks today

Adidas
4 tasks today
```

---

## Account Director

```text
Good morning, Sarah

Today

32 tasks
24 completed
4 overdue
2 blocked

75% completion
```

Then:

```text
Your Accounts

Nike
82%
2 overdue

Adidas
91%
On track

Coca-Cola
73%
1 blocked
```

Then:

```text
Needs Attention

Nike
2 overdue tasks

John Cruz
3 unfinished tasks due today

Coca-Cola
1 blocked task
```

---

## Senior Director

```text
Department Overview

74 tasks today
58 completed
6 overdue
3 blocked

78% completion
```

Then compare Account Directors:

```text
Sarah Johnson
83% completion
3 accounts

James Miller
76% completion
4 accounts
```

Senior leadership should be able to drill down from here.

---

# All Accounts

`All Accounts` gives a cross-client view.

Example:

| Account | Account Director | People | Today | Completion | Overdue |
|---|---|---:|---:|---:|---:|
| Nike | Sarah | 6 | 12 | 82% | 2 |
| Adidas | Sarah | 4 | 9 | 91% | 0 |
| Coca-Cola | James | 5 | 11 | 73% | 1 |

Clicking an account opens its account workspace.

---

# People

People is also cross-account.

Purpose:

> Who is doing what across the agency?

Example:

```text
Anna Santos
Designer

Accounts
Nike · Adidas

5 tasks today
4 completed
1 in progress

80% completion
```

Another:

```text
John Cruz
Copywriter

Accounts
Nike · Coca-Cola

7 tasks today
3 completed

2 overdue
```

Clicking a person can show:

```text
Anna Santos

Overview
Tasks
Accounts
Performance
```

---

# Reports

Reports remain global but can be filtered by scope.

Example:

```text
Reports

[ Department ▾ ]
[ Account ▾ ]
[ Person ▾ ]
[ Last 7 Days ▾ ]
```

Primary metric:

```text
Daily Completion Rate
```

Definition:

```text
Tasks completed / tasks due that day
```

Example:

```text
18 completed / 24 due

75%
```

Supporting metrics:

```text
Completed Tasks
126

Completion Rate
84%

On-Time Rate
89%

Overdue Tasks
8
```

---

# Task Model

Tasks should remain single records even if they appear in several views.

Suggested structure:

```ts
Task {
  id
  title
  description?

  accountId
  campaignId?

  assigneeIds[]

  type
  status
  priority?

  dueDate?
  completedAt?

  tags[]
}
```

---

# Account Membership Model

Add an account membership relationship.

Suggested structure:

```ts
AccountMembership {
  id
  accountId
  userId

  role
}
```

Example:

```text
userId: anna
accountId: nike
role: Designer
```

And:

```text
userId: anna
accountId: adidas
role: Designer
```

Do not store only one `accountId` directly on the user.

Users can belong to multiple accounts.

---

# Important Distinction

Account membership and task assignment are different concepts.

A person may belong to Nike but not be assigned to every Nike task.

Example:

```text
Nike Team

Anna
John
Maria
David
```

Task:

```text
Design landing page

Assigned:
Anna
John
```

So:

```text
Account Membership
= who belongs to the account

Task Assignee
= who is responsible for this specific work
```

---

# Collaborative Tasks

Tasks must support multiple assignees.

Example:

```text
Review Campaign Assets

Assignees

Anna Santos
John Cruz
+ Add person
```

Only users with access to the account should normally appear in the account task assignee picker.

---

# Design Direction

Keep the current visual style.

Do not redesign the whole application.

The main UX change is the sidebar and information architecture.

Avoid:

- nested sidebars
- horizontal tabs + sidebar navigation at the same time
- deep project hierarchy
- too many task properties
- ClickUp-style customization
- giant dashboards
- CRM features

The product should still feel very lightweight.

---

# Sidebar Visual Hierarchy

Make account names visually stronger than their nested links.

Example:

```text
▾ Nike
    Overview
    Tasks
    Campaigns
    Team
```

Nested items should have:

- smaller indentation
- slightly lower visual emphasis
- clear active state

Example active page:

```text
▾ Nike
    Overview
  > Tasks
    Campaigns
    Team
```

---

# Core UX Mental Model

Global views answer:

```text
Overview
= How is everything I'm responsible for doing?

Today
= What is happening today?

My Tasks
= What do I personally need to do?

People
= Who is doing what?

Reports
= How is work performing over time?
```

Account views answer:

```text
Overview
= How is this client doing?

Tasks
= What work needs to be done?

Campaigns
= What initiatives are active?

Team
= Who is working on this client?
```

---

# Key Product Principle

A user can work across multiple accounts, but they should still have one unified work experience.

For example, Anna may belong to:

```text
Nike
Adidas
```

She should be able to work in two ways.

## Personal execution

```text
My Tasks
→ See work from Nike + Adidas together
```

## Client context

```text
Nike
→ Tasks
→ Campaigns
→ Team
```

This distinction is intentional.

**My Tasks = work across all my clients**

**Account = context for one client**

---

# Do Not Duplicate Data

The same task can appear in:

```text
My Tasks
Today
Nike → Tasks
Nike → Campaign
Anna → Tasks
Reports
Director Overview
```

but it must remain a single task record.

These are different views and filters over the same source of truth.

---

# Why This Change Matters

The previous team-first structure assumes people belong to one fixed organizational group.

Agency work is more fluid.

People may be shared across multiple accounts, and Account Directors may manage several clients simultaneously.

The updated structure supports this directly:

```text
People can belong to many accounts.

Accounts have many people.

Tasks belong to an account.

Tasks can have multiple assignees.

Campaigns provide additional context inside an account.
```

This gives team members one clear place to manage their personal workload while still giving Account Directors and Senior Directors strong client-level and department-level visibility.
