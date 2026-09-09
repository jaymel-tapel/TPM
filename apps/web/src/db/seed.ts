import "./load-env";
import bcrypt from "bcryptjs";
import { pool, db } from "./index";
import {
  accountMembers,
  boardStatuses,
  campaigns,
  boards,
  documents,
  folders,
  taskDocuments,
  leaveRequests,
  tags,
  taskAssignees,
  taskTags,
  tasks,
  accounts,
  users,
  type Priority,
  type TaskType,
} from "./schema";
import { eq } from "drizzle-orm";
import { DEMO_PASSWORD } from "../lib/constants";
import { lastNDays, now, startOfAppDay } from "../lib/date";
import { dayKey } from "../lib/leave";
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
  /** Which director's book they sit in. Null for the Senior Director. */
  pod: "A" | "B" | null;
  /** Their craft, which is a fact about them rather than about one client. */
  title: string | null;
  /** Share of that person's tasks finished by end of the day they were due. */
  reliability: number;
  /** Share of their misses that are still sitting open. */
  abandon: number;
  perDay: [number, number];
};

const SENIOR: Person = {
  name: "Elena Rivera",
  role: "senior_director",
  pod: null,
  title: null,
  reliability: 0.9,
  abandon: 0.1,
  perDay: [0, 0],
};

/**
 * The clients each Account Director carries.
 *
 * A "pod" is a director's book of business, not a team — nobody in the product
 * belongs to one. It exists here only so the seed knows which accounts a
 * person could plausibly be shared across, and which director signs their
 * leave off.
 */
const BOOK = {
  A: ["Volvo", "MG", "Kia"],
  B: ["Peugeot", "BYD"],
} as const;

type Pod = keyof typeof BOOK;

const member = (
  name: string,
  pod: Pod,
  title: string,
  reliability: number,
  // Most people eventually finish what they miss. Keeping the default low means
  // the few who genuinely fall behind stand out instead of everyone showing a
  // token overdue task.
  abandon = 0.06,
): Person => ({ name, role: "team_member", pod, title, reliability, abandon, perDay: [4, 7] });

const director = (name: string, pod: Pod, reliability: number): Person => ({
  name,
  role: "account_director",
  pod,
  title: "Account Director",
  reliability,
  abandon: 0.1,
  perDay: [2, 4],
});

const PEOPLE: Person[] = [
  SENIOR,
  director("Sarah Lim", "A", 0.86),
  director("Michael Ortega", "B", 0.83),

  // Sarah's book — Volvo, MG and Kia. The brief's named people, plus
  // the rest of the roster.
  member("Anna Santos", "A", "Designer", 0.85),
  member("James Cruz", "A", "Copywriter", 0.46, 0.42), // the person Needs Attention should surface
  member("Sofia Reyes", "A", "Strategist", 0.97, 0.05),
  member("Marco Ilagan", "A", "Designer", 0.82),
  member("Bea Fernandez", "A", "Paid Media", 0.88),
  member("Rafael Ong", "A", "Copywriter", 0.79),
  member("Nadine Chua", "A", "Account Manager", 0.84),
  member("Paolo Rivera", "A", "Motion Designer", 0.76),
  member("Trina Bautista", "A", "Strategist", 0.9),
  member("Kevin Dizon", "A", "Paid Media", 0.8),
  member("Isabel Moreno", "A", "Designer", 0.86),
  member("Andres Lim", "A", "Analyst", 0.78),
  member("Camille Yap", "A", "Copywriter", 0.83),
  member("Victor Salazar", "A", "Account Manager", 0.75, 0.25),

  // Michael's book — Peugeot and BYD.
  member("Grace Tolentino", "B", "Paid Media", 0.88),
  member("Leo Mendoza", "B", "Analyst", 0.8),
  member("Patricia Uy", "B", "Designer", 0.85),
  member("Daniel Reyes", "B", "Copywriter", 0.72, 0.25),
  member("Mika Villanueva", "B", "Strategist", 0.9),
  member("Joaquin Perez", "B", "Paid Media", 0.76),
  member("Hannah Cruz", "B", "Account Manager", 0.83),
  member("Emil Navarro", "B", "Motion Designer", 0.7, 0.3),
  member("Clarisse Tan", "B", "Designer", 0.87),
  member("Ruben Aquino", "B", "Analyst", 0.74),
  member("Yasmin Delgado", "B", "Copywriter", 0.86),
  member("Oscar Batungbakal", "B", "Paid Media", 0.78),
  member("Lianne Gomez", "B", "Account Manager", 0.84),
];

/**
 * Which accounts somebody works on.
 *
 * A director carries their whole book. Everybody else has a home client, plus
 * — often enough that the demo shows it rather than mentions it — one more in
 * the same book. Deterministic per person, so tuning one roster never
 * reshuffles anybody else's.
 *
 * Anna Santos is pinned to Volvo and MG: she is the person the brief's
 * worked example follows, and the handoff's own illustration of somebody
 * shared between two clients.
 */
function accountsFor(person: Person, index: number): string[] {
  if (!person.pod) return [];
  const book = BOOK[person.pod];
  if (person.role === "account_director") return [...book];
  if (person.name === "Anna Santos") return ["Volvo", "MG"];

  const home = book[index % book.length]!;
  const stream = streamFor(`${person.name}:accounts`);
  const also = book.filter((name) => name !== home && stream() < 0.4);
  return [home, ...also];
}

/**
 * Michael's book dipped this week; Sarah's held steady. Applied on top of each
 * person's reliability so the Senior Director's "completion down vs last week"
 * signal has something real to find.
 */
function weekFactor(pod: "A" | "B" | null, daysAgo: number): number {
  if (pod !== "B") return 1;
  return daysAgo <= 6 ? 0.93 : 1.08;
}

/** Days are not identical. A deterministic wobble keeps the trend readable. */
function dayFactor(daysAgo: number): number {
  const wobble = 0.085 * Math.sin(daysAgo * 1.7) + 0.04 * Math.cos(daysAgo * 0.6);
  // Normalised so today sits on the baseline and only past days wobble.
  return 1 + wobble - 0.04;
}

/** Every account, in the order the two books declare them. */
const CLIENTS = [...BOOK.A, ...BOOK.B];

/**
 * Three campaigns per client — one finished, one running, one booked.
 *
 * Offsets are days from today rather than fixed dates, so a seed run in
 * February shows the same shape as one in September: something to look back
 * on, something to be in the middle of, and something to prepare for.
 *
 * The finished one has to sit *inside* the three weeks of history the seed
 * writes, or it wraps with no work in it and reads as broken. The booked one
 * legitimately has none — nothing is due yet, which is what "planned" means.
 */
const CAMPAIGNS: Record<string, { name: string; from: number; to: number }[]> = {
  Volvo: [
    { name: "EX30 Launch", from: -20, to: -11 },
    { name: "Safety Always-On", from: -10, to: 20 },
    { name: "Year-End Sales Event", from: 30, to: 74 },
  ],
  MG: [
    { name: "ZS Hybrid Reveal", from: -19, to: -12 },
    { name: "Always-On Social", from: -11, to: 26 },
    { name: "Motor Show Stand", from: 34, to: 70 },
  ],
  Kia: [
    { name: "Sonet Facelift", from: -21, to: -13 },
    { name: "Service Retention", from: -12, to: 24 },
    { name: "New Year Test Drive", from: 28, to: 66 },
  ],
  Peugeot: [
    { name: "3008 Relaunch", from: -18, to: -10 },
    { name: "Dealer Co-Op", from: -9, to: 22 },
    { name: "Spring Showroom", from: 32, to: 68 },
  ],
  BYD: [
    { name: "Seal Launch", from: -20, to: -14 },
    { name: "Always-On Demand", from: -13, to: 28 },
    { name: "Fleet & Corporate", from: 26, to: 62 },
  ],
};

const TITLES: Record<TaskType, string[]> = {
  client_work: [
    "Prepare client monthly report",
    "Send client performance report",
    "Update ad budget",
    "Build media plan for {client}",
    "Draft {client} campaign brief",
    "Reconcile {client} spend",
    "Pull weekly {client} metrics",
    "Update {client} model page copy",
    "Brief dealer co-op assets for {client}",
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
    "QA test-drive booking flow",
    "Sign off on creative rounds",
    "Proof final creative assets",
  ],
  meeting: [
    "Weekly meeting notes",
    "{client} status call",
    "Account stand-up",
    "Quarterly planning session",
    "Client onboarding call",
  ],
  creative: [
    "Draft social concepts for {client}",
    "Storyboard launch film",
    "Book showroom photography",
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

/** The client's own name goes into the title, rather than a name picked at random. */
function pickTitle(type: TaskType, client: string): string {
  return pick(TITLES[type]).replace("{client}", client);
}

function pickPriority(): Priority {
  const r = rnd();
  if (r < 0.08) return "urgent";
  if (r < 0.28) return "high";
  return "normal";
}

/*
 * Tags stop pretending to be clients. "Volvo" is an account now — a row with an
 * owner, a board and a roster — and leaving it in the tag list as well would
 * give the same fact two homes that could disagree. What is left is what a tag
 * was always good at: a word about the *kind* of work.
 */
const TAG_NAMES = ["launch", "monthly", "urgent-client", "reporting"];

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
  await db.delete(leaveRequests);
  await db.delete(accountMembers);
  await db.delete(taskDocuments);
  await db.delete(documents);
  await db.delete(folders);
  await db.delete(taskTags);
  await db.delete(taskAssignees);
  await db.delete(tasks);
  // After tasks: a task points at its campaign, so the campaign cannot go first.
  await db.delete(campaigns);
  await db.delete(tags);
  await db.delete(boardStatuses);
  await db.delete(boards);
  await db.update(accounts).set({ accountDirectorId: null });
  await db.delete(users);
  await db.delete(accounts);

  console.log("Creating accounts and users…");
  const accountRows = await db
    .insert(accounts)
    .values(CLIENTS.map((name) => ({ name })))
    .returning();
  const accountByName = new Map(accountRows.map((a) => [a.name, a]));
  const accountId = (name: string) => accountByName.get(name)!.id;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const inserted = await db
    .insert(users)
    .values(
      PEOPLE.map((p) => ({
        name: p.name,
        email: emailFor(p.name),
        passwordHash,
        role: p.role,
        title: p.title,
      })),
    )
    .returning();

  const byName = new Map(inserted.map((u) => [u.name, u]));
  const idOf = (name: string) => byName.get(name)!.id;

  /*
   * Who works on what. This is the table the whole shape exists for, so the
   * demo has to show it rather than describe it: roughly a third of the roster
   * carries two clients, and Anna carries Volvo and MG by name.
   */
  const accountsOf = new Map<string, string[]>(
    PEOPLE.map((p, index) => [p.name, accountsFor(p, index)]),
  );
  await db.insert(accountMembers).values(
    [...accountsOf].flatMap(([name, names]) =>
      names.map((account) => ({ accountId: accountId(account), userId: idOf(name) })),
    ),
  );

  for (const [pod, director] of [["A", "Sarah Lim"], ["B", "Michael Ortega"]] as const) {
    for (const name of BOOK[pod]) {
      await db
        .update(accounts)
        .set({ accountDirectorId: idOf(director) })
        .where(eq(accounts.id, accountId(name)));
    }
  }

  /*
   * One board per account, with the four columns that used to be the status
   * enum. Boards are where work lives, so the seed has to create them before
   * it can create a task.
   *
   * Named for the work, not for the account that owns it. A board called
   * "Volvo" sitting under a rail group called "Volvo" reads as a mistake — one
   * line saying the same word twice.
   */
  const BOARD_NAME: Record<string, string> = {
    Volvo: "Brand & Creative",
    MG: "Always-On Social",
    Kia: "Campaign Delivery",
    Peugeot: "Performance & Media",
    BYD: "Content & Reporting",
  };

  const boardRows = await db
    .insert(boards)
    .values(
      CLIENTS.map((name) => ({
        accountId: accountId(name),
        name: BOARD_NAME[name]!,
        position: 0,
        createdBy: idOf(BOOK.A.includes(name as never) ? "Sarah Lim" : "Michael Ortega"),
      })),
    )
    .returning();
  const boardOf = (client: string) =>
    boardRows.find((b) => b.accountId === accountId(client))!;

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
  const statusOf = (client: string, name: string) =>
    statusRows.find((r) => r.boardId === boardOf(client).id && r.name === name)!;

  /*
   * A campaign is a fortnight of work with a name and an end, which is the
   * thing a tag could never be. Status follows the dates rather than being
   * chosen separately: a campaign that ended last month is wrapped, whatever
   * anybody clicked.
   */
  const campaignRows = await db
    .insert(campaigns)
    .values(
      CLIENTS.flatMap((client) =>
        CAMPAIGNS[client]!.map((c) => ({
          accountId: accountId(client),
          name: c.name,
          startsOn: dayKey(new Date(today.getTime() + c.from * DAY)),
          endsOn: dayKey(new Date(today.getTime() + c.to * DAY)),
          status: (c.to < 0 ? "wrapped" : c.from > 0 ? "planned" : "live") as
            | "wrapped"
            | "planned"
            | "live",
        })),
      ),
    )
    .returning();

  /**
   * The campaign a piece of work belongs to, if any.
   *
   * Matched on the calendar rather than picked at random: work due in October
   * cannot be part of a campaign that ended in August. Plenty of work belongs
   * to no campaign at all — a retainer's monthly reporting belongs to the
   * client and to nothing smaller — so this only claims about half of what it
   * could.
   */
  const campaignFor = (client: string, due: Date): string | null => {
    const day = dayKey(due);
    const candidates = campaignRows.filter(
      (c) => c.accountId === accountId(client) && c.startsOn <= day && c.endsOn >= day,
    );
    if (candidates.length === 0 || !chance(0.55)) return null;
    return pick(candidates).id;
  };

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
    /** The client this work is for, by name. */
    account: string;
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
      boardId: boardOf(opts.account).id,
      statusId: statusOf(opts.account, COLUMN_FOR[opts.status]).id,
      dueDate: opts.due,
      createdBy: opts.createdBy,
      accountId: accountId(opts.account),
      campaignId: campaignFor(opts.account, opts.due),
      completedAt: opts.completedAt,
      createdAt: new Date(opts.due.getTime() - between(0.2, 1.6) * DAY),
      updatedAt: opts.completedAt ?? opts.due,
    });
    for (const userId of opts.assignees) assigneeRows.push({ taskId: id, userId });
    // If the title already names a client, tag it with that one rather than a
    // contradictory second client.
    // The client is on the row now, so a tag only ever says what kind of work
    // this is — no round trip through the title to recover who it is for.
    if (chance(0.5)) {
      tagLinks.push({ taskId: id, tagId: tagByName.get(pick(TAG_NAMES))! });
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
    const boost = person.pod === "A" ? 1.03 : 1;
    const rate = Math.min(
      0.98,
      person.reliability * boost * weekFactor(person.pod, daysAgo) * dayFactor(daysAgo),
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

  const workers = PEOPLE.filter((p) => p.pod !== null);

  for (const [index, dayStart] of days.entries()) {
    const daysAgo = days.length - 1 - index;
    const isToday = daysAgo === 0;
    const weekend = [0, 6].includes(
      new Date(dayStart.getTime() + 12 * HOUR).getUTCDay(),
    );

    for (const person of workers) {
      rnd = streamFor(person.name);
      const uid = idOf(person.name);
      const mine = accountsOf.get(person.name)!;
      /*
       * Work lands on one of the accounts they actually work on, weighted to
       * the first — somebody covering two clients still has a main one. Doing
       * it any other way would put Anna's MG work on Volvo's board, and the
       * composite key on `tasks` would refuse it anyway.
       */
      const clientFor = () => (mine.length === 1 || chance(0.7) ? mine[0]! : pick(mine.slice(1)));
      const podDirector = person.pod === "A" ? "Sarah Lim" : "Michael Ortega";
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

        const client = clientFor();
        addTask({
          title: pickTitle(type, client),
          type,
          priority: pickPriority(),
          due,
          account: client,
          createdBy: chance(0.75) ? uid : idOf(podDirector),
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
  for (const client of CLIENTS) {
    // Everyone who works on this client, which is what makes a shared task
    // shareable — and, for somebody on two accounts, puts them in both pools.
    const roster = workers.filter(
      (p) => p.role === "team_member" && accountsOf.get(p.name)!.includes(client),
    );
    if (roster.length < 2) continue;
    const ad = BOOK.A.includes(client as never) ? "Sarah Lim" : "Michael Ortega";
    for (let i = 0; i < 5; i++) {
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
        title: pickTitle(type, client),
        type,
        priority: chance(0.5) ? "high" : "normal",
        due,
        account: client,
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
    const client = accountsOf.get(name)![0]!;
    const type = pickType();
    addTask({
      title: pickTitle(type, client),
      type,
      priority: "high",
      due: new Date(wallClock.getTime() + between(0.5, 1.8) * HOUR),
      account: client,
      createdBy: idOf(person.pod === "A" ? "Sarah Lim" : "Michael Ortega"),
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

  const makeFolder = async (folder: {
    name: string;
    account?: string | null;
    parentId?: string | null;
    author: string;
  }) => {
    const [row] = await db
      .insert(folders)
      .values({
        name: folder.name,
        visibility: folder.account ? "account" : "org",
        accountId: folder.account ?? null,
        parentId: folder.parentId ?? null,
        createdBy: idOf(folder.author),
      })
      .returning();
    return row!;
  };

  const writeDoc = async (doc: {
    title: string;
    lines: string[];
    account?: string | null;
    folderId?: string | null;
    author: string;
  }) => {
    const text = body(...doc.lines);
    const [row] = await db
      .insert(documents)
      .values({
        title: doc.title,
        body: text,
        searchText: toPlainText(text),
        visibility: doc.account ? "account" : "org",
        accountId: doc.account ?? null,
        folderId: doc.folderId ?? null,
        createdBy: idOf(doc.author),
      })
      .returning();
    return row!;
  };

  // Folders hold; documents say something. The department's handbook is a
  // folder because that is what it is — a place several documents live.
  const handbook = await makeFolder({ name: "How we work", author: "Elena Rivera" });

  await writeDoc({
    title: "Start here",
    lines: [
      "Everything the department agrees on lives in this folder. If a task keeps restating something, it belongs here instead.",
      "A task points at a document; it does not copy it.",
    ],
    folderId: handbook.id,
    author: "Elena Rivera",
  });

  // A folder inside a folder, so the demo shows that folders nest.
  const escalationFolder = await makeFolder({
    name: "Escalation",
    parentId: handbook.id,
    author: "Elena Rivera",
  });

  const escalation = await writeDoc({
    title: "When to escalate",
    lines: [
      "Blocked for more than a day is an escalation, not a status. Say who you are waiting on.",
      "Client-facing problems go to the Account Director the same day.",
    ],
    folderId: escalationFolder.id,
    author: "Elena Rivera",
  });

  await writeDoc({
    title: "Out of hours",
    lines: ["Nothing is urgent after seven unless a client is live. Then it is the duty director."],
    folderId: escalationFolder.id,
    author: "Elena Rivera",
  });

  const brand = await writeDoc({
    title: "Brand guidelines",
    lines: [
      "Blue #5B88F7 carries identity and actions. Yellow #FFC72C is the single most important number on a screen, and nothing else.",
      "Never set a headline in anything but the brand grotesque.",
    ],
    folderId: handbook.id,
    author: "Elena Rivera",
  });

  const volvoFolder = await makeFolder({
    name: "Volvo",
    account: accountId("Volvo"),
    author: "Sarah Lim",
  });

  const runbookA = await writeDoc({
    title: "Runbook",
    lines: ["How Volvo files work, names columns and hands over on a Friday."],
    account: accountId("Volvo"),
    folderId: volvoFolder.id,
    author: "Sarah Lim",
  });

  await writeDoc({
    title: "Reporting checklist",
    lines: ["Pull the numbers on Monday. Completion is measured against the day a task was due."],
    account: accountId("Volvo"),
    folderId: volvoFolder.id,
    author: "Sarah Lim",
  });

  const mgFolder = await makeFolder({
    name: "MG",
    account: accountId("MG"),
    author: "Michael Ortega",
  });

  await writeDoc({
    title: "Runbook",
    lines: ["How MG files work. Not visible to a client that is not MG."],
    account: accountId("MG"),
    folderId: mgFolder.id,
    author: "Michael Ortega",
  });

  // One loose document, so the top level is not only folders.
  await writeDoc({
    title: "Holidays",
    lines: ["File it under Leave. Your director approves it. That is the whole process."],
    author: "Elena Rivera",
  });

  /*
   * A couple of tasks that actually reference something, so the chips, the
   * backlinks and the `@` picker all have something to show on a fresh seed.
   */
  const volvoTasks = taskRows.filter((t) => t.accountId === accountId("Volvo")).slice(0, 2);
  if (volvoTasks[0]) {
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
      .where(eq(tasks.id, volvoTasks[0].id!));

    await db
      .insert(taskDocuments)
      .values([
        { taskId: volvoTasks[0].id!, documentId: brand.id, source: "attached" as const },
        { taskId: volvoTasks[0].id!, documentId: escalation.id, source: "mentioned" as const },
      ])
      .onConflictDoNothing();
  }
  if (volvoTasks[1]) {
    await db
      .insert(taskDocuments)
      .values({ taskId: volvoTasks[1].id!, documentId: runbookA.id, source: "attached" as const })
      .onConflictDoNothing();
  }

  console.log("Booking leave…");

  /*
   * Enough leave that the feature is visible the moment you sign in, and
   * shaped so the org chart explains itself: somebody is off right now on
   * both accounts, Sarah has a queue, and Sarah's own request can only be
   * settled by Elena.
   *
   * Offsets are days from the seed's own today, so the demo is always
   * relative to when it was built rather than to a date in the past.
   */
  const on = (offset: number) => dayKey(new Date(today.getTime() + offset * 24 * HOUR));

  await db.insert(leaveRequests).values([
    // Away right now, so `/account` and `/accounts` both show a marker on load.
    {
      userId: idOf("Sofia Reyes"),
      kind: "vacation" as const,
      startDate: on(0),
      endDate: on(1),
      status: "approved" as const,
      decidedBy: idOf("Sarah Lim"),
      decidedAt: new Date(today.getTime() - 5 * 24 * HOUR),
    },
    // The half-day marker, without anyone having to click for it.
    {
      userId: idOf("Rafael Ong"),
      kind: "personal" as const,
      startDate: on(0),
      endDate: on(0),
      half: "am" as const,
      status: "approved" as const,
      decidedBy: idOf("Sarah Lim"),
      decidedAt: new Date(today.getTime() - 2 * 24 * HOUR),
    },
    // Sarah's queue, one of each shape.
    {
      userId: idOf("Marco Ilagan"),
      kind: "vacation" as const,
      startDate: on(7),
      endDate: on(9),
      status: "pending" as const,
      note: "Booked flights back in June.",
    },
    {
      userId: idOf("Bea Fernandez"),
      kind: "personal" as const,
      startDate: on(10),
      endDate: on(10),
      half: "pm" as const,
      status: "pending" as const,
    },
    // Something in "Coming up" that is not also away today.
    {
      userId: idOf("Nadine Chua"),
      kind: "vacation" as const,
      startDate: on(10),
      endDate: on(12),
      status: "approved" as const,
      decidedBy: idOf("Sarah Lim"),
      decidedAt: new Date(today.getTime() - 9 * 24 * HOUR),
    },
    // The two outcomes nobody wants, so every state is reachable on /leave.
    {
      userId: idOf("Kevin Dizon"),
      kind: "unpaid" as const,
      startDate: on(-9),
      endDate: on(-7),
      status: "declined" as const,
      decidedBy: idOf("Sarah Lim"),
      decidedAt: new Date(today.getTime() - 14 * 24 * HOUR),
      decisionNote: "Two people already off that week — try the week after?",
    },
    {
      userId: idOf("Trina Bautista"),
      kind: "sick" as const,
      startDate: on(-4),
      endDate: on(-4),
      status: "cancelled" as const,
    },
    // Michael's book, so the Senior Director sees availability across both.
    {
      userId: idOf("Leo Mendoza"),
      kind: "vacation" as const,
      startDate: on(0),
      endDate: on(2),
      status: "approved" as const,
      decidedBy: idOf("Michael Ortega"),
      decidedAt: new Date(today.getTime() - 6 * 24 * HOUR),
    },
    /*
     * The row that tells the whole story without a word of explanation:
     * Sarah cannot decide her own, so it sits in Elena's queue on /accounts.
     */
    {
      userId: idOf("Sarah Lim"),
      kind: "vacation" as const,
      startDate: on(14),
      endDate: on(15),
      status: "pending" as const,
    },
  ]);

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
