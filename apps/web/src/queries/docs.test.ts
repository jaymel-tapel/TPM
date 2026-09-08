import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, folders, taskDocuments, users, type User } from "@/db/schema";
import {
  getDocBacklinks,
  getDocTree,
  getLinkedDocs,
  filterVisibleDocIds,
  searchDocs,
} from "./docs";
import { syncMentionedDocs } from "@/lib/doc-links";
import { canCreateOrgDocs, canEditDoc, canPlaceDoc, canViewDoc } from "@/lib/permissions";
import {
  IDS,
  addDoc,
  addFolder,
  addTask,
  bodyMentioning,
  linkDoc,
  resetDb,
  seedOrg,
} from "../../test/fixture";

const load = async (id: string): Promise<User> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new Error(`no such user ${id}`);
  return user;
};

type Tree = Awaited<ReturnType<typeof getDocTree>>;

/** Every name in the tree, folders and documents alike, flattened and sorted. */
function names(tree: Tree): string[] {
  const out: string[] = tree.documents.map((d) => d.title);
  const walk = (folders: Tree["folders"]) => {
    for (const folder of folders) {
      out.push(folder.name);
      out.push(...folder.documents.map((d) => d.title));
      walk(folder.folders);
    }
  };
  walk(tree.folders);
  return out.sort();
}

describe("who can read a document", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    await addDoc({ title: "Handbook", team: null });
    await addDoc({ title: "Team A runbook", team: IDS.teamA });
    await addDoc({ title: "Team B runbook", team: IDS.teamB });
  });

  it("shows a member the department's documents and their own team's, and nobody else's", async () => {
    const anna = await load(IDS.anna); // Team A
    expect(names(await getDocTree(anna))).toEqual(["Handbook", "Team A runbook"]);
  });

  it("scopes an account director to their own team the same way", async () => {
    const sarah = await load(IDS.sarah); // Team A's director
    expect(names(await getDocTree(sarah))).toEqual(["Handbook", "Team A runbook"]);
  });

  it("shows the senior director everything", async () => {
    const elena = await load(IDS.elena);
    expect(names(await getDocTree(elena))).toEqual([
      "Handbook",
      "Team A runbook",
      "Team B runbook",
    ]);
  });

  it("refuses a team document to someone on no team at all", async () => {
    // A senior director has no team; every other teamless account must fall
    // through to org-wide only rather than matching `team_id = null`.
    await db.update(users).set({ role: "team_member" }).where(eq(users.id, IDS.elena));
    const loose = await load(IDS.elena);
    expect(names(await getDocTree(loose))).toEqual(["Handbook"]);
  });
});

describe("the tree", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("puts documents inside their folder, and hides a folder the viewer cannot see", async () => {
    const folder = await addFolder({ name: "Team B", team: IDS.teamB });
    await addDoc({ title: "Escalation", folder });

    const elena = await load(IDS.elena);
    const tree = await getDocTree(elena);
    expect(tree.folders.map((f) => f.name)).toEqual(["Team B"]);
    expect(tree.folders[0].documents.map((d) => d.title)).toEqual(["Escalation"]);

    // Anna is on Team A. Neither the folder nor what is in it may appear — a
    // document must not float up to the top level because its folder was
    // filtered out.
    const anna = await load(IDS.anna);
    const hers = await getDocTree(anna);
    expect(hers.folders).toEqual([]);
    expect(hers.documents).toEqual([]);
  });

  it("keeps a document with no folder at the top level", async () => {
    await addDoc({ title: "Holidays", team: null });
    const tree = await getDocTree(await load(IDS.anna));
    expect(tree.documents.map((d) => d.title)).toEqual(["Holidays"]);
    expect(tree.folders).toEqual([]);
  });

  it("nests folders inside folders", async () => {
    const outer = await addFolder({ name: "How we work", team: null });
    const inner = await addFolder({ name: "Escalation", parent: outer });
    await addDoc({ title: "Out of hours", folder: inner });

    const tree = await getDocTree(await load(IDS.anna));
    expect(tree.folders.map((f) => f.name)).toEqual(["How we work"]);
    expect(tree.folders[0].folders.map((f) => f.name)).toEqual(["Escalation"]);
    expect(tree.folders[0].folders[0].documents.map((d) => d.title)).toEqual(["Out of hours"]);
  });

  it("gives what is inside a folder the folder's placement", async () => {
    const folder = await addFolder({ name: "How we work", team: null });
    const doc = await addDoc({ title: "Expenses", team: IDS.teamB, folder });

    const row = await db.query.documents.findFirst({ where: eq(documents.id, doc) });
    expect(row?.visibility).toBe("org");
    expect(row?.teamId).toBeNull();
  });

  it("takes everything with it when a folder is deleted", async () => {
    const outer = await addFolder({ name: "How we work", team: null });
    const inner = await addFolder({ name: "Escalation", parent: outer });
    await addDoc({ title: "Out of hours", folder: inner });
    await addDoc({ title: "Start here", folder: outer });

    await db.delete(folders).where(eq(folders.id, outer));
    expect(await db.select().from(documents)).toHaveLength(0);
    expect(await db.select().from(folders)).toHaveLength(0);
  });

  it("takes a team's folders when the team goes", async () => {
    const folder = await addFolder({ name: "Team A", team: IDS.teamA });
    await addDoc({ title: "Runbook", folder });
    // Only folders are under test; the team's other dependants are cleared
    // first so the delete can land.
    await db.execute(`delete from tasks where team_id = '${IDS.teamA}'`);
    await db.execute(`delete from boards where team_id = '${IDS.teamA}'`);
    await db.execute(`update users set team_id = null where team_id = '${IDS.teamA}'`);
    await db.execute(`update teams set account_director_id = null where id = '${IDS.teamA}'`);
    await db.execute(`delete from teams where id = '${IDS.teamA}'`);

    expect(await db.select().from(folders)).toHaveLength(0);
    expect(await db.select().from(documents)).toHaveLength(0);
  });
});

describe("the visibility check on ids from a form", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("drops an id the person was never allowed to see", async () => {
    const mine = await addDoc({ title: "Handbook", team: null });
    const theirs = await addDoc({ title: "Team B runbook", team: IDS.teamB });

    const anna = await load(IDS.anna);
    expect(await filterVisibleDocIds(anna, [mine, theirs])).toEqual([mine]);
  });
});

describe("search", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("finds a word that appears only in the body, and never one out of scope", async () => {
    await addDoc({
      title: "Handbook",
      team: null,
      body: JSON.stringify([
        {
          type: "paragraph",
          content: [{ type: "text", text: "Escalate to the duty director.", styles: {} }],
        },
      ]),
    });
    await addDoc({
      title: "Team B escalation",
      team: IDS.teamB,
      body: JSON.stringify([
        {
          type: "paragraph",
          content: [{ type: "text", text: "Escalate to Mika.", styles: {} }],
        },
      ]),
    });

    const anna = await load(IDS.anna);
    const hits = await searchDocs(anna, "escalate");
    expect(hits.map((h) => h.title)).toEqual(["Handbook"]);
    // The snippet arrives as runs, and at least one of them is the match.
    expect(hits[0].snippet.some((run) => run.hit)).toBe(true);

    const elena = await load(IDS.elena);
    expect((await searchDocs(elena, "escalate")).map((h) => h.title).sort()).toEqual([
      "Handbook",
      "Team B escalation",
    ]);
  });

  it("takes a multi-word query as a search rather than a syntax error", async () => {
    await addDoc({ title: "Brand guidelines", team: null });
    const anna = await load(IDS.anna);
    await expect(searchDocs(anna, "brand guidelines")).resolves.toHaveLength(1);
  });
});

describe("mentions and attachments are separate links", () => {
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("drops a removed mention and leaves the attachment alone", async () => {
    const anna = await load(IDS.anna);
    const brand = await addDoc({ title: "Brand", team: null });
    const tone = await addDoc({ title: "Tone", team: null });
    const task = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });

    // Attached on purpose, and also named in the prose.
    await linkDoc(task, brand, "attached");
    await syncMentionedDocs(
      anna,
      task,
      bodyMentioning("Follow ", [
        { id: brand, title: "Brand" },
        { id: tone, title: "Tone" },
      ]),
    );

    expect(await db.select().from(taskDocuments)).toHaveLength(3);
    expect((await getLinkedDocs(anna, task)).map((d) => d.title).sort()).toEqual([
      "Brand",
      "Tone",
    ]);

    // The prose stops mentioning either. The deliberate attachment survives —
    // this is the whole reason `source` is part of the key.
    await syncMentionedDocs(anna, task, bodyMentioning("Nothing to see.", []));

    const left = await getLinkedDocs(anna, task);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ title: "Brand", attached: true, mentioned: false });
  });

  it("refuses to link a document the author cannot see", async () => {
    const anna = await load(IDS.anna); // Team A
    const theirs = await addDoc({ title: "Team B runbook", team: IDS.teamB });
    const task = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });

    // A hand-written payload naming another team's document.
    await syncMentionedDocs(
      anna,
      task,
      bodyMentioning("See ", [{ id: theirs, title: "Team B runbook" }]),
    );

    expect(await db.select().from(taskDocuments)).toHaveLength(0);
  });

  it("lists the tasks pointing back at a document", async () => {
    const anna = await load(IDS.anna);
    const brand = await addDoc({ title: "Brand", team: null });
    const attached = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });
    const mentioned = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 1 });

    await linkDoc(attached, brand, "attached");
    await linkDoc(mentioned, brand, "mentioned");

    const backlinks = await getDocBacklinks(anna, brand);
    expect(backlinks).toHaveLength(2);
    expect(backlinks.find((b) => b.id === attached)?.mentionedOnly).toBe(false);
    expect(backlinks.find((b) => b.id === mentioned)?.mentionedOnly).toBe(true);
  });
});

describe("who can write a document", () => {
  const org = { visibility: "org" as const, teamId: null };
  const teamA = { visibility: "team" as const, teamId: IDS.teamA };
  const teamB = { visibility: "team" as const, teamId: IDS.teamB };

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("lets both kinds of director publish to the whole department", async () => {
    expect(canCreateOrgDocs(await load(IDS.elena))).toBe(true); // senior
    expect(canCreateOrgDocs(await load(IDS.sarah))).toBe(true); // account director
    expect(canEditDoc(await load(IDS.sarah), org)).toBe(true);
  });

  it("does not let a team member write one", async () => {
    const anna = await load(IDS.anna);
    expect(canCreateOrgDocs(anna)).toBe(false);
    expect(canEditDoc(anna, org)).toBe(false);
    expect(canPlaceDoc(anna, org)).toBe(false);
    // Reading is a separate question, and the answer there is yes.
    expect(canViewDoc(anna, org)).toBe(true);
  });

  it("lets a team member write their own team's documents", async () => {
    const anna = await load(IDS.anna); // Team A, plain member
    expect(canEditDoc(anna, teamA)).toBe(true);
    expect(canPlaceDoc(anna, teamA)).toBe(true);
  });

  it("still stops them writing another team's", async () => {
    const anna = await load(IDS.anna);
    expect(canEditDoc(anna, teamB)).toBe(false);
    expect(canPlaceDoc(anna, teamB)).toBe(false);
  });

  it("gives the senior director every team", async () => {
    const elena = await load(IDS.elena); // no team of their own
    expect(canPlaceDoc(elena, teamA)).toBe(true);
    expect(canPlaceDoc(elena, teamB)).toBe(true);
  });

  it("refuses a member a child of an org-wide document", async () => {
    // A child adopts its parent's scope, so filing under an org-wide document
    // is publishing an org-wide document by another name.
    const anna = await load(IDS.anna);
    expect(canPlaceDoc(anna, org)).toBe(false);
    expect(canPlaceDoc(await load(IDS.sarah), org)).toBe(true);
  });

  it("refuses a team placement with no team behind it", async () => {
    // The check constraint forbids the row; this refuses it a step earlier.
    expect(canPlaceDoc(await load(IDS.sarah), { visibility: "team", teamId: null })).toBe(false);
  });
});
