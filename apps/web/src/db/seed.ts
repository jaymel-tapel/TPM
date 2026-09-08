import "./load-env";
import bcrypt from "bcryptjs";
import { pool, db } from "./index";
import {
  boardStatuses,
  boards,
  documents,
  taskDocuments,
  tags,
  taskAssignees,
  taskTags,
  tasks,
  teams,
  users,
  type Priority,
  type TaskType,
} from "./schema";
import { eq } from "drizzle-orm";
import { DEMO_PASSWORD } from "../lib/constants";
import { lastNDays, now, startOfAppDay } from "../lib/date";
import { toPlainText } from "@meridian/ui/editor";

/**
 * The seed still thinks in the four original statuses, because that is what
 * the scenario in the brief is written in. This maps them onto the columns of
 * the board it creates.
 */
type SeedStatus = "todo" | "in_progress" | "done" | "blocked";
const COLUMN_FOR: Record<SeedStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
};

/**
 * Deterministic seed. Every run produces the same org, the same task mix and
 * the same headline numbers, so screenshots and reports stay reproducible.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260906;

/**
 * Each person draws from their own stream, so tuning one person's numbers
 * never reshuffles anybody else's history. `rnd` points at whichever stream is
 * currently in scope; the helpers below read it through the binding.
 */
const hashName = (s: string) =>
  [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const globalRnd = mulberry32(SEED);
let rnd = globalRnd;

const streams = new Map<string, () => number>();
function streamFor(name: string) {
  let stream = streams.get(name);
  if (!stream) {
    stream = mulberry32((SEED ^ hashName(name)) >>> 0);
    streams.set(name, stream);
  }
  return stream;
}

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const intBetween = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const chance = (p: number) => rnd() < p;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const HISTORY_DAYS = 21;
/** Misses older than this window were always eventually finished (late). */
const OPEN_WINDOW_DAYS = 3;

type Person = {
  name: string;
  role: "team_member" | "account_director" | "senior_director";
  team: "A" | "B" | null;
  /** Share of that person's tasks finished by end of the day they were due. */
  reliability: number;
  /** Share of their misses that are still sitting open. */
  abandon: number;
  perDay: [number, number];
};

const SENIOR: Person = {
  name: "Elena Rivera",
  role: "senior_director",
  team: null,
  reliability: 0.9,
  abandon: 0.1,
  perDay: [0, 0],
};

const member = (
  name: string,
  team: "A" | "B",
  reliability: number,
  // Most people eventually finish what they miss. Keeping the default low means
  // the few who genuinely fall behind stand out instead of everyone showing a
  // token overdue task.
  abandon = 0.06,
): Person => ({ name, role: "team_member", team, reliability, abandon, perDay: [4, 7] });

const director = (name: string, team: "A" | "B", reliability: number): Person => ({
  name,
  role: "account_director",
  team,
  reliability,
  abandon: 0.1,
  perDay: [2, 4],
});

const PEOPLE: Person[] = [
  SENIOR,
  director("Sarah Lim", "A", 0.86),
  director("Michael Ortega", "B", 0.83),

  // Team A — the brief's named people plus the rest of the roster.
  member("Anna Santos", "A", 0.85),
  member("James Cruz", "A", 0.46, 0.42), // the person Needs Attention should surface
  member("Sofia Reyes", "A", 0.97, 0.05),
  member("Marco Ilagan", "A", 0.82),
  member("Bea Fernandez", "A", 0.88),
  member("Rafael Ong", "A", 0.79),
  member("Nadine Chua", "A", 0.84),
  member("Paolo Rivera", "A", 0.76),
  member("Trina Bautista", "A", 0.9),
  member("Kevin Dizon", "A", 0.8),
  member("Isabel Moreno", "A", 0.86),
  member("Andres Lim", "A", 0.78),
  member("Camille Yap", "A", 0.83),
  member("Victor Salazar", "A", 0.75, 0.25),

  // Team B
  member("Grace Tolentino", "B", 0.88),
  member("Leo Mendoza", "B", 0.8),
  member("Patricia Uy", "B", 0.85),
  member("Daniel Reyes", "B", 0.72, 0.25),
  member("Mika Villanueva", "B", 0.9),
  member("Joaquin Perez", "B", 0.76),
  member("Hannah Cruz", "B", 0.83),
  member("Emil Navarro", "B", 0.7, 0.3),
  member("Clarisse Tan", "B", 0.87),
  member("Ruben Aquino", "B", 0.74),
  member("Yasmin Delgado", "B", 0.86),
  member("Oscar Batungbakal", "B", 0.78),
  member("Lianne Gomez", "B", 0.84),
];

/**
 * Team B dipped this week; Team A held steady. Applied on top of each person's
 * reliability so the Senior Director's "completion down vs last week" signal
 * has something real to find.
 */
function weekFactor(team: "A" | "B" | null, daysAgo: number): number {
  if (team !== "B") return 1;
  return daysAgo <= 6 ? 0.93 : 1.08;
}

/** Days are not identical. A deterministic wobble keeps the trend readable. */
function dayFactor(daysAgo: number): number {
  const wobble = 0.085 * Math.sin(daysAgo * 1.7) + 0.04 * Math.cos(daysAgo * 0.6);
  // Normalised so today sits on the baseline and only past days wobble.
  return 1 + wobble - 0.04;
}

const CLIENTS = ["Nike", "Aveda", "Northline", "Cortado", "Halcyon"];

const TITLES: Record<TaskType, string[]> = {
  client_work: [
    "Prepare client monthly report",
    "Send client performance report",
    "Update ad budget",
    "Build media plan for {client}",
    "Draft {client} campaign brief",
    "Reconcile {client} spend",
    "Pull weekly {client} metrics",
  ],
  internal: [
    "Update campaign budget",
    "Tidy shared asset library",
    "Refresh channel benchmarks",
    "Write handover notes",
    "Prep next sprint priorities",
  ],
  admin: [
    "File monthly expenses",
    "Update timesheet",
    "Approve vendor invoice",
    "Renew software licence",
  ],
  review: [
    "Review campaign launch assets",
    "Review {client} landing page copy",
    "QA tracking setup",
    "Sign off on creative rounds",
    "Proof final creative assets",
  ],
  meeting: [
    "Weekly meeting notes",
    "{client} status call",
    "Team stand-up",
    "Quarterly planning session",
    "Client onboarding call",
  ],
  creative: [
    "Draft social concepts for {client}",
    "Storyboard launch video",
    "Design report cover",
    "Write ad variations",
    "Send final creative assets",
  ],
};

const TYPE_WEIGHTS: [TaskType, number][] = [
  ["client_work", 0.34],
  ["review", 0.16],
  ["internal", 0.18],
  ["meeting", 0.12],
  ["creative", 0.11],
  ["admin", 0.09],
];

function pickType(): TaskType {
  let r = rnd();
  for (const [type, w] of TYPE_WEIGHTS) {
    if ((r -= w) <= 0) return type;
  }
  return "internal";
}

function pickTitle(type: TaskType): string {
  return pick(TITLES[type]).replace("{client}", pick(CLIENTS));
}

function pickPriority(): Priority {
  const r = rnd();
  if (r < 0.08) return "urgent";
  if (r < 0.28) return "high";
  return "normal";
}

const TAG_NAMES = [...CLIENTS, "launch", "monthly", "urgent-client", "reporting"];

function emailFor(name: string) {
  return `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(/ +/g, ".")}@meridian.co`;
}

type NewTask = typeof tasks.$inferInsert & { id: string };

async function main() {
  const wallClock = now();
  const today = startOfAppDay(wallClock);

  /**
   * Outcomes for today are generated against a full working day even when the
   * seed is run late at night or first thing in the morning, so the demo
   * always has a day's work to show rather than an empty screen. Everything
   * else — overdue, trends, history — is measured against the real clock.
   */
  const reference = new Date(Math.max(wallClock.getTime(), today.getTime() + 19 * HOUR));
  const days = lastNDays(HISTORY_DAYS, reference); // oldest first, today last

  console.log("Clearing existing data…");
  await db.delete(taskDocuments);
  await db.delete(documents);
  await db.delete(taskTags);
  await db.delete(taskAssignees);
  await db.delete(tasks);
  await db.delete(tags);
  await db.delete(boardStatuses);
  await db.delete(boards);
  await db.update(teams).set({ accountDirectorId: null });
  await db.delete(users);
  await db.delete(teams);

  console.log("Creating teams and users…");
  const [teamA, teamB] = await db
    .insert(teams)
    .values([{ name: "Team A" }, { name: "Team B" }])
    .returning();
  const teamId = { A: teamA.id, B: teamB.id } as const;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const inserted = await db
    .insert(users)
    .values(
      PEOPLE.map((p) => ({
        name: p.name,
        email: emailFor(p.name),
        passwordHash,
        role: p.role,
        teamId: p.team ? teamId[p.team] : null,
      })),
    )
    .returning();

  const byName = new Map(inserted.map((u) => [u.name, u]));
  const idOf = (name: string) => byName.get(name)!.id;

  await db
    .update(teams)
    .set({ accountDirectorId: idOf("Sarah Lim") })
    .where(eq(teams.id, teamA.id));
  await db
    .update(teams)
    .set({ accountDirectorId: idOf("Michael Ortega") })
    .where(eq(teams.id, teamB.id));

  /*
   * One board per team, with the four columns that used to be the status
   * enum. Boards are now where work lives, so the seed has to create them
   * before it can create a task.
   */
  const boardRows = await db
    .insert(boards)
    .values([
      { teamId: teamA.id, name: "Team A", position: 0, createdBy: idOf("Sarah Lim") },
      { teamId: teamB.id, name: "Team B", position: 0, createdBy: idOf("Michael Ortega") },
    ])
    .returning();
  const boardOf = { A: boardRows[0]!, B: boardRows[1]! } as const;

  const DEFAULT_COLUMNS = [
    { name: "To Do", kind: "open" as const, position: 0 },
    { name: "In Progress", kind: "open" as const, position: 1 },
    { name: "Done", kind: "done" as const, position: 2 },
    { name: "Blocked", kind: "blocked" as const, position: 3 },
  ];

  const statusRows = await db
    .insert(boardStatuses)
    .values(
      boardRows.flatMap((b) => DEFAULT_COLUMNS.map((c) => ({ ...c, boardId: b.id }))),
    )
    .returning();

  /** Board + legacy status name -> the status row to file work under. */
  const statusOf = (team: "A" | "B", name: string) =>
    statusRows.find((r) => r.boardId === boardOf[team].id && r.name === name)!;

  const tagRows = await db
    .insert(tags)
    .values(TAG_NAMES.map((name) => ({ name })))
    .returning();
  const tagByName = new Map(tagRows.map((t) => [t.name, t.id]));

  console.log("Generating tasks…");
  const taskRows: NewTask[] = [];
  const assigneeRows: (typeof taskAssignees.$inferInsert)[] = [];
  const tagLinks: (typeof taskTags.$inferInsert)[] = [];

  let counter = 0;
  const newId = () => {
    counter += 1;
    // Deterministic UUIDv4-shaped ids so reruns produce identical rows.
    const hex = (n: number) =>
      Math.floor(rnd() * 16 ** n)
        .toString(16)
        .padStart(n, "0");
    return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${counter
      .toString(16)
      .padStart(4, "0")}${hex(8)}`;
  };

  function addTask(opts: {
    title: string;
    type: TaskType;
    priority: Priority;
    due: Date;
    team: "A" | "B";
    createdBy: string;
    assignees: string[];
    status: SeedStatus;
    completedAt: Date | null;
    description?: string | null;
  }) {
    const id = newId();
    taskRows.push({
      id,
      title: opts.title,
      description: opts.description ?? null,
      type: opts.type,
      priority: opts.priority,
      boardId: boardOf[opts.team].id,
      statusId: statusOf(opts.team, COLUMN_FOR[opts.status]).id,
      dueDate: opts.due,
      createdBy: opts.createdBy,
      teamId: teamId[opts.team],
      completedAt: opts.completedAt,
      createdAt: new Date(opts.due.getTime() - between(0.2, 1.6) * DAY),
      updatedAt: opts.completedAt ?? opts.due,
    });
    for (const userId of opts.assignees) assigneeRows.push({ taskId: id, userId });
    // If the title already names a client, tag it with that one rather than a
    // contradictory second client.
    const namedClient = CLIENTS.find((c) => opts.title.includes(c));
    if (namedClient) {
      tagLinks.push({ taskId: id, tagId: tagByName.get(namedClient)! });
    } else if (chance(0.5)) {
      tagLinks.push({
        taskId: id,
        tagId: tagByName.get(pick(["launch", "monthly", "urgent-client", "reporting"]))!,
      });
    }
    return id;
  }

  /**
   * Decides the outcome of one task: finished on time, finished late, or still
   * open. `completed_at` is what the reports read, so it is always set for
   * anything that was ever finished — including the late ones.
   */
  function resolveOutcome(
    person: Person,
    due: Date,
    dayStart: Date,
    daysAgo: number,
  ): { status: SeedStatus; completedAt: Date | null } {
    const boost = person.team === "A" ? 1.03 : 1;
    const rate = Math.min(
      0.98,
      person.reliability * boost * weekFactor(person.team, daysAgo) * dayFactor(daysAgo),
    );
    const dayEnd = new Date(dayStart.getTime() + DAY);
    const nowMs = reference.getTime();

    if (chance(rate)) {
      // Finished by end of the day it was due.
      const earliest = dayStart.getTime() + 8 * HOUR;
      const latest = Math.min(due.getTime() + HOUR, dayEnd.getTime() - HOUR, nowMs);
      if (latest <= earliest) return { status: "done", completedAt: new Date(Math.min(nowMs, dayStart.getTime() + 9 * HOUR)) };
      return { status: "done", completedAt: new Date(between(earliest, latest)) };
    }

    const recent = daysAgo <= OPEN_WINDOW_DAYS;
    if (recent && chance(person.abandon)) {
      if (chance(0.12)) return { status: "blocked", completedAt: null };
      return { status: chance(0.4) ? "in_progress" : "todo", completedAt: null };
    }
    if (daysAgo === 0) {
      // Today's misses simply have not been done yet.
      return { status: chance(0.35) ? "in_progress" : "todo", completedAt: null };
    }

    // Finished, but after the day it was due — counts against that day's rate.
    const late = dayEnd.getTime() + between(1, 36) * HOUR;
    if (late >= nowMs) return { status: chance(0.4) ? "in_progress" : "todo", completedAt: null };
    return { status: "done", completedAt: new Date(late) };
  }

  const workers = PEOPLE.filter((p) => p.team !== null);

  for (const [index, dayStart] of days.entries()) {
    const daysAgo = days.length - 1 - index;
    const isToday = daysAgo === 0;
    const weekend = [0, 6].includes(
      new Date(dayStart.getTime() + 12 * HOUR).getUTCDay(),
    );

    for (const person of workers) {
      rnd = streamFor(person.name);
      const uid = idOf(person.name);
      let count = intBetween(person.perDay[0], person.perDay[1]);
      if (weekend && !isToday) count = Math.max(0, count - 3);

      // The brief's example: Anna opens on 3 of 5 completed.
      const annaToday = isToday && person.name === "Anna Santos";
      if (annaToday) count = 5;

      for (let i = 0; i < count; i++) {
        const type = pickType();
        const dueHour = between(9, 18);
        const due = new Date(dayStart.getTime() + dueHour * HOUR);

        let outcome = resolveOutcome(person, due, dayStart, daysAgo);
        if (annaToday) {
          const done = i < 3;
          outcome = done
            ? {
                status: "done",
                completedAt: new Date(
                  Math.max(
                    dayStart.getTime() + 8 * HOUR,
                    reference.getTime() - between(0.5, 4) * HOUR,
                  ),
                ),
              }
            : { status: i === 3 ? "in_progress" : "todo", completedAt: null };
        }

        addTask({
          title: pickTitle(type),
          type,
          priority: pickPriority(),
          due,
          team: person.team!,
          createdBy: chance(0.75) ? uid : idOf(person.team === "A" ? "Sarah Lim" : "Michael Ortega"),
          assignees: [uid],
          status: outcome.status,
          completedAt: outcome.completedAt,
          description: chance(0.3)
            ? "Carried over from the weekly planning session. Keep the client-facing version short."
            : null,
        });
      }
    }
  }

  // Collaborative work: shared tasks with 2-3 assignees. A few are left open
  // past their due date so the Needs Attention sections have something to say.
  console.log("Generating collaborative tasks…");
  rnd = globalRnd;
  for (const team of ["A", "B"] as const) {
    const roster = workers.filter((p) => p.team === team && p.role === "team_member");
    const ad = team === "A" ? "Sarah Lim" : "Michael Ortega";
    for (let i = 0; i < 9; i++) {
      const daysAgo = intBetween(0, 9);
      const dayStart = new Date(today.getTime() - daysAgo * DAY);
      const due = new Date(dayStart.getTime() + between(10, 17) * HOUR);
      // Anna's day is the brief's worked example (3 of 5), so it is left alone.
      const pool = daysAgo === 0 ? roster.filter((p) => p.name !== "Anna Santos") : roster;
      const group = [...pool].sort(() => rnd() - 0.5).slice(0, intBetween(2, 3));
      const stillOpen = i < 2 || (daysAgo <= 2 && chance(0.4));
      const completedAt = stillOpen
        ? null
        : new Date(Math.min(reference.getTime() - HOUR, due.getTime() - between(0.5, 5) * HOUR));
      const type = pick(["client_work", "review", "creative"] as const);
      addTask({
        title: pickTitle(type),
        type,
        priority: chance(0.5) ? "high" : "normal",
        due,
        team,
        createdBy: idOf(ad),
        assignees: group.map((p) => idOf(p.name)),
        status: completedAt ? "done" : chance(0.5) ? "in_progress" : "todo",
        completedAt,
        description: "Shared task — completing it marks it done for everyone assigned.",
      });
    }
  }

  // Guarantee the "due within 2 hours" signal regardless of when the seed runs.
  // This one keys off the real clock, since the app compares it to real time.
  rnd = globalRnd;
  for (const name of ["James Cruz", "Nadine Chua", "Leo Mendoza", "Ruben Aquino"]) {
    const person = PEOPLE.find((p) => p.name === name)!;
    const type = pickType();
    addTask({
      title: pickTitle(type),
      type,
      priority: "high",
      due: new Date(wallClock.getTime() + between(0.5, 1.8) * HOUR),
      team: person.team!,
      createdBy: idOf(person.team === "A" ? "Sarah Lim" : "Michael Ortega"),
      assignees: [idOf(name)],
      status: "todo",
      completedAt: null,
    });
  }

  console.log(`Inserting ${taskRows.length} tasks…`);
  for (let i = 0; i < taskRows.length; i += 500) {
    await db.insert(tasks).values(taskRows.slice(i, i + 500));
  }
  for (let i = 0; i < assigneeRows.length; i += 1000) {
    await db.insert(taskAssignees).values(assigneeRows.slice(i, i + 1000));
  }
  for (let i = 0; i < tagLinks.length; i += 1000) {
    await db.insert(taskTags).values(tagLinks.slice(i, i + 1000)).onConflictDoNothing();
  }

  console.log("Writing documents…");

  /** A BlockNote paragraph, the shape the editor stores. */
  const para = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text, styles: {} }],
  });
  const body = (...lines: string[]) => JSON.stringify(lines.map(para));

  const writeDoc = async (doc: {
    title: string;
    lines: string[];
    team?: string | null;
    parentId?: string | null;
    author: string;
  }) => {
    const text = body(...doc.lines);
    const [row] = await db
      .insert(documents)
      .values({
        title: doc.title,
        body: text,
        searchText: toPlainText(text),
        visibility: doc.team ? "team" : "org",
        teamId: doc.team ?? null,
        parentId: doc.parentId ?? null,
        createdBy: idOf(doc.author),
      })
      .returning();
    return row!;
  };

  const handbook = await writeDoc({
    title: "How we work",
    lines: [
      "Everything the department agrees on, in one place. If a task keeps restating it, it belongs here instead.",
      "A task points at a document; it does not copy it.",
    ],
    author: "Elena Rivera",
  });

  const escalation = await writeDoc({
    title: "Escalation",
    lines: [
      "Blocked for more than a day is an escalation, not a status. Say who you are waiting on.",
      "Client-facing problems go to the Account Director the same day.",
    ],
    parentId: handbook.id,
    author: "Elena Rivera",
  });

  await writeDoc({
    title: "Out of hours",
    lines: ["Nothing is urgent after seven unless a client is live. Then it is the duty director."],
    parentId: escalation.id,
    author: "Elena Rivera",
  });

  const brand = await writeDoc({
    title: "Brand guidelines",
    lines: [
      "Blue #5B88F7 carries identity and actions. Yellow #FFC72C is the single most important number on a screen, and nothing else.",
      "Never set a headline in anything but the brand grotesque.",
    ],
    author: "Elena Rivera",
  });

  const runbookA = await writeDoc({
    title: "Team A runbook",
    lines: ["How Team A files work, names columns and hands over on a Friday."],
    team: teamA.id,
    author: "Sarah Lim",
  });

  await writeDoc({
    title: "Reporting checklist",
    lines: ["Pull the numbers on Monday. Completion is measured against the day a task was due."],
    parentId: runbookA.id,
    author: "Sarah Lim",
  });

  await writeDoc({
    title: "Team B runbook",
    lines: ["How Team B files work. Not visible to Team A."],
    team: teamB.id,
    author: "Michael Ortega",
  });

  /*
   * A couple of tasks that actually reference something, so the chips, the
   * backlinks and the `@` picker all have something to show on a fresh seed.
   */
  const teamATasks = taskRows.filter((t) => t.teamId === teamA.id).slice(0, 2);
  if (teamATasks[0]) {
    // The prose has to actually name it: a `mentioned` row is derived from the
    // description on every save, so one without a matching chip would vanish
    // the first time anybody touched the task.
    await db
      .update(tasks)
      .set({
        description: JSON.stringify([
          {
            type: "paragraph",
            content: [
              { type: "text", text: "If this stalls, follow ", styles: {} },
              {
                type: "docMention",
                props: { docId: escalation.id, title: escalation.title, stale: false },
              },
              { type: "text", text: ".", styles: {} },
            ],
          },
        ]),
      })
      .where(eq(tasks.id, teamATasks[0].id!));

    await db
      .insert(taskDocuments)
      .values([
        { taskId: teamATasks[0].id!, documentId: brand.id, source: "attached" as const },
        { taskId: teamATasks[0].id!, documentId: escalation.id, source: "mentioned" as const },
      ])
      .onConflictDoNothing();
  }
  if (teamATasks[1]) {
    await db
      .insert(taskDocuments)
      .values({ taskId: teamATasks[1].id!, documentId: runbookA.id, source: "attached" as const })
      .onConflictDoNothing();
  }

  console.log("");
  console.log(`Seeded ${inserted.length} people, ${taskRows.length} tasks.`);
  console.log(`All accounts share the password: ${DEMO_PASSWORD}`);
  console.log(`  Team member      ${emailFor("Anna Santos")}`);
  console.log(`  Account Director ${emailFor("Sarah Lim")}`);
  console.log(`  Senior Director  ${emailFor("Elena Rivera")}`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
