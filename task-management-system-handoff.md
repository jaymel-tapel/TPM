# Task Management System — Design & Build Handoff

## Goal

Build a **simple internal task management system** for a 30-person department.

The product should feel significantly simpler than ClickUp. It should not look or behave like a generic project management platform.

The core job of the system is:

> Give each person clarity on what they need to do today, give Account Directors visibility into their team, and give the Senior Director a clear view of department performance.

The product should feel like a lightweight **daily operating system for the department**, not a configurable workspace tool.

---

# Product Structure

There are 3 levels of visibility:

1. **Team Member**
   - What do I need to do today?
   - What is overdue?
   - What have I completed?

2. **Account Director**
   - What is everyone on my team working on?
   - Who is falling behind?
   - What is blocked or overdue?
   - How is the team performing today?

3. **Senior Director**
   - How are both teams performing?
   - Which team or person needs attention?
   - What are the productivity / completion trends?

The hierarchy should be built into the product.

Users should not need to create dashboards, configure views, build spaces, folders, or lists.

---

# Primary Navigation

Keep navigation intentionally small.

## Team Member

- Today
- My Tasks

## Account Director

- Today
- Team
- Reports

## Senior Director

- Overview
- Teams
- Reports

Do not add navigation for features that are not essential.

Avoid a ClickUp-style dense sidebar.

---

# Core UX Principle

## Today before everything

The system should open around **today's work**.

Do not make Kanban the default interface.

The default experience should feel more like a clean daily work sheet.

Example:

```text
Good morning, Anna

Sunday, September 6

TODAY

[ ] Send client performance report
    Client Work · Due 2:00 PM

[~] Review launch assets
    Collaborative · James + Sofia

[ ] Update campaign budget
    High Priority

COMPLETED

[x] Weekly meeting notes
[x] Send final creative assets

3 of 5 completed
60%
```

The UI should make the answer to "what should I do now?" obvious.

---

# Visual Direction

The interface should visually align with the company website.

Reference vibe:

- bright blue primary brand background
- dark navy content sections
- white cards / surfaces
- bold yellow accent
- strong editorial typography
- generous whitespace
- clean geometric layouts
- friendly, modern agency feel
- minimal but not sterile

The system should feel like it belongs to the same brand, without copying the marketing website literally.

---

# Suggested Color System

Use the website as the visual anchor.

Approximate palette:

```css
--brand-blue: #5B88F7;
--brand-blue-deep: #4F79E8;
--navy: #2D3148;
--navy-soft: #373C55;
--yellow: #FFC72C;
--white: #FFFFFF;
--off-white: #F6F7FA;
--text: #202335;
--muted: #73798B;
--border: #E6E8EF;
--success: #3BA272;
--danger: #D85C5C;
```

Use yellow sparingly.

Yellow should be used for:
- highlighted words
- key status indicators
- active controls
- small emphasis moments

Do not flood the UI with yellow.

Blue should provide the brand identity.

White should provide most working surfaces.

Navy should be used for high-level summaries, navigation, and leadership-focused sections.

---

# Typography

Use a bold, modern sans-serif.

Good options:
- Inter
- Manrope
- DM Sans
- Geist

Use strong typography hierarchy.

Suggested:

```text
Page title       32–40px / bold
Section title    20–24px / semibold
Card metric      28–36px / bold
Body             14–16px
Metadata         12–13px
```

Avoid tiny UI text.

The website uses big, confident headline treatment, so the app should retain some of that personality.

---

# Layout Style

Avoid dense dashboards.

Prefer:

- large clear headings
- wide cards
- strong grouping
- fewer metrics
- large readable numbers
- short labels
- limited borders
- soft spacing between sections

Use cards only where they help hierarchy.

Do not put everything inside a card.

---

# Screen 1 — My Day

This is the main screen for a normal team member.

## Header

```text
Good morning, Anna

Sunday, September 6
```

Optional small completion summary:

```text
3 of 5 tasks completed today
```

---

## Today

Each task row should be visually simple.

Example:

```text
○  Prepare client monthly report             Today, 2:00 PM
   Client Work · Nike
```

Collaborative:

```text
◐  Review campaign launch assets
   James + Sofia · Collaborative
```

High priority:

```text
○  Update ad budget
   High Priority
```

Do not show every possible task property at once.

Only show:

- title
- due time/date
- key tag/type
- collaborators if relevant
- priority if important

---

## Completed

Collapsed or visually quieter.

```text
✓ Weekly meeting notes
✓ Campaign assets sent
```

---

## Daily Completion

At the bottom or top-right:

```text
TODAY
60%

3 / 5 completed
```

Could use a simple horizontal progress bar.

Avoid gamification.

---

# Screen 2 — Task Detail / Create Task

Keep this screen extremely lightweight.

Fields:

```text
Task title

Description

Due date

Task type

Assignees

Priority

Tags
```

Status:

```text
To Do
In Progress
Done
```

Optional exceptional state:

```text
Blocked
```

Do not create a custom status builder.

Do not add:
- Gantt dependencies
- custom fields
- custom workflows
- watchers
- spaces
- folders
- complex recurrence
- time estimation
- time tracking

unless specifically requested later.

---

# Collaborative Tasks

Support multiple assignees.

Data model should use a many-to-many relationship.

Example:

```text
Prepare Q3 client presentation

Assigned:
- Anna
- James
- Sofia
```

For MVP, the task is shared.

If any assignee completes it, the shared task becomes complete.

Future extension:

A collaborative task may contain individual contributions:

```text
Anna  — Data
James — Slides
Sofia — Review
```

Do not implement contribution-level completion unless there is enough time.

---

# Screen 3 — Account Director / Team Today

This should be one of the strongest screens in the prototype.

The Account Director should understand the team in seconds.

## Header

```text
Team A

Today
15 people
42 active tasks
31 completed
```

Main metric:

```text
74% completion
```

---

## Team Members

Use clean rows.

Example:

```text
Anna Santos
5 / 6 completed
1 remaining

James Cruz
3 / 7 completed
2 overdue

Sofia Reyes
6 / 6 completed
Done for today
```

Possible right-side indicator:

```text
83%
43%
100%
```

Clicking a person opens their task list.

---

## Needs Attention

Create a small leadership-focused section.

Example:

```text
NEEDS ATTENTION

James Cruz
2 overdue tasks

Campaign Team
4 tasks due within 2 hours

3 collaborative tasks
still incomplete
```

This is more useful than making the director interpret charts.

---

# Screen 4 — Senior Director Overview

This is not just a bigger team dashboard.

The Senior Director needs patterns and exceptions.

## Hero Summary

Use a dark navy section.

Example:

```text
Department Today

30 people
87 tasks due
68 completed

78%
Completion rate
```

Use yellow highlight for the most important number or phrase.

---

## Team Comparison

```text
TEAM A

81%
completion

5 overdue

Account Director
Sarah


TEAM B

74%
completion

6 overdue

Account Director
Michael
```

Keep comparison visual and simple.

No giant analytics grid.

---

## Needs Attention

Example:

```text
NEEDS ATTENTION

James
7 overdue tasks

Team B
Completion down 12% vs last week

Client Reporting
Lowest completion rate this week
```

This section should feel like the system is surfacing what leadership needs to know.

---

# Screen 5 — Productivity / Completion Report

Do not make this a giant BI dashboard.

Use only metrics that help answer:

> Are we getting the work done consistently?

---

## Main Metrics

- Tasks due
- Tasks completed
- Completion rate
- Completed on time
- Overdue tasks
- Average completion time

Optional:

- completion by task type
- workload per person
- workload by team

---

## Daily Completion Trend

Simple chart:

```text
Mon   81%
Tue   76%
Wed   88%
Thu   91%
Fri   84%
```

Use one clean line or bar chart.

Do not add multiple graphs just to fill the screen.

---

# Completion Rate Definition

Use:

```text
Tasks due that day completed by end of day
-------------------------------------------
Total tasks due that day
```

This is better than:

```text
Total tasks completed
---------------------
Total tasks created
```

because backlog should not distort today's productivity.

---

# Task Types

Start with a small fixed list.

Suggested:

- Client Work
- Internal
- Admin
- Review
- Meeting
- Creative

If their actual workflow has specific task types, make these configurable later.

Do not make type creation part of the main MVP flow.

---

# Filters

Only expose filters when relevant.

For Team / Reports:

```text
Person
Status
Task Type
Priority
Date
Tag
```

Use compact dropdown chips.

Do not create a heavy query-builder UI.

---

# Design Details

## Buttons

Primary button:

```text
+ New Task
```

Blue background or dark navy depending on context.

Secondary actions should be text-based where possible.

Avoid excessive icon-only actions.

---

## Task Status

Use very simple visual markers.

```text
○ To Do
◐ In Progress
✓ Done
! Blocked
```

Color can reinforce state, but the state should still be understandable without color.

---

## Progress

Prefer:

```text
7 / 10 completed
70%
```

with a simple horizontal bar.

Avoid circular gamified score widgets unless they clearly improve readability.

---

# Dashboard Philosophy

Do not create a dashboard full of widgets.

The system should answer questions directly.

Bad:

```text
14 different metric cards
6 charts
multiple dropdown filters
```

Better:

```text
78% completion today

Team A       81%
Team B       74%

Needs Attention
3 items
```

---

# Brand Application

The marketing website mixes:

- bright blue sections
- dark navy sections
- white content areas
- yellow typography accents

Translate that into the app like this:

### App shell
Off-white / very pale gray

### Top navigation / sidebar
White or dark navy

### Leadership hero cards
Dark navy

### Active navigation
Brand blue

### Key highlighted metric
Yellow accent

### Primary buttons
Brand blue

### Main working cards
White

This keeps the system usable for hours while still feeling branded.

Do not use a full bright-blue background behind the entire productivity interface.

That works for the marketing site but would be tiring in a work app.

---

# Desktop Layout

Primary target should be desktop.

Suggested structure:

```text
┌────────────────────────────────────────────────────────┐
│ Logo        Today     Team     Reports       Anna      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Team Today                                             │
│  Sunday, September 6                                   │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 74% completed     31 / 42 tasks     2 overdue   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Team Members                                          │
│                                                        │
│  Anna       5 / 6     █████████░        83%           │
│  James      3 / 7     ████░░░░░░        43%           │
│  Sofia      6 / 6     ██████████       100%           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

Use a top navigation rather than a giant feature-heavy sidebar.

A compact left rail is acceptable, but it should only contain 3–4 items.

---

# Role Switching for Demo

For the test prototype, add a development-only role selector.

Example:

```text
Viewing as:
Senior Director ▼
```

Options:

- Team Member
- Account Director
- Senior Director

This makes the hierarchy easy to demonstrate without separate accounts.

Do not include this in the production concept.

---

# Permissions

## Team Member

Can:
- create tasks
- view own tasks
- update own assigned tasks
- view collaborative tasks
- add collaborators
- mark work complete

## Account Director

Can:
- view all team members
- view all team tasks
- create / assign tasks
- inspect individual workload
- view team reports

## Senior Director

Can:
- view both teams
- compare teams
- drill into any employee
- view department reports
- inspect overdue / blocked work

---

# Suggested Data Model

```text
User
- id
- name
- email
- role
- team_id

Team
- id
- name
- account_director_id

Task
- id
- title
- description
- type
- status
- priority
- due_date
- created_by
- team_id
- completed_at

TaskAssignee
- task_id
- user_id

Tag
- id
- name

TaskTag
- task_id
- tag_id
```

Important:

Do not put a single `assignee_id` field directly on Task.

Use `TaskAssignee` because one task can belong to multiple people.

---

# Suggested Enum Structure

```ts
type Role =
  | "team_member"
  | "account_director"
  | "senior_director";

type TaskStatus =
  | "todo"
  | "in_progress"
  | "done"
  | "blocked";

type Priority =
  | "normal"
  | "high"
  | "urgent";
```

---

# Technical Direction

Suggested stack if starting from scratch:

```text
Frontend
Next.js
TypeScript
Tailwind CSS

Backend
Next.js server actions / API routes

Database
PostgreSQL

ORM
Prisma or Drizzle

Auth
Clerk / Better Auth / Supabase Auth

Charts
Recharts
```

Keep architecture straightforward.

This is a 30-person internal department system, so optimize for:

- maintainability
- speed of development
- clear permissions
- reliable reporting

not premature scale.

---

# Suggested Tables

```sql
users
teams
tasks
task_assignees
tags
task_tags
```

Optional later:

```sql
task_activity
comments
```

---

# Reporting Query Considerations

Completion should use `completed_at`, not only the current task status.

This allows historical reporting.

Example:

```text
Task status = Done
completed_at = 2026-09-06 14:35
```

Without `completed_at`, accurate daily reports become difficult.

Also preserve:

```text
created_at
due_date
completed_at
```

These are enough for most initial completion reporting.

---

# MVP Priority

## Must Have

- authentication
- role-based views
- create task
- edit task
- multiple assignees
- due date
- task type
- tags
- priority
- To Do / In Progress / Done
- My Day
- Team Today
- Senior Director Overview
- completion reporting
- overdue reporting

## Nice to Have

- comments
- activity history
- blocked state
- notifications
- recurring tasks

## Do Not Build for Test

- Gantt
- docs
- chat
- whiteboards
- custom dashboards
- custom fields
- automations builder
- nested spaces
- folders
- project templates
- multiple arbitrary views
- time tracking
- workload forecasting

---

# Product Principle

The prototype should communicate this clearly:

> ClickUp optimizes for flexibility. This system optimizes for clarity.

The organization already has a known structure:

```text
Senior Director
      ↓
2 Account Directors
      ↓
~15 people per team
```

Use that constraint.

Do not ask users to configure the organization manually every day.

The system should know what each role needs.

---

# Desired Feeling

When a Team Member opens the system:

> I know exactly what I need to do today.

When an Account Director opens the system:

> I know exactly how my team is doing.

When the Senior Director opens the system:

> I know where the department stands and where attention is needed.

If the interface achieves those three things, the product is working.

---

# Final Design Rule

Whenever adding a feature, ask:

> Does this make today's work or leadership visibility clearer?

If not, leave it out.

The system should require almost no training.

**Less managing the task manager. More knowing what's happening.**
