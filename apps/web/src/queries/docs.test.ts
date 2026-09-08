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
import { IDS, addDoc, addFolder, addTask, bodyMentioning, linkDoc, resetDb, seedOrg, viewerFor } from "../../test/fixture";

/** The `Viewer` a page would have been handed — accounts resolved, as in a session. */
const load = viewerFor;

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
    await addDoc({ title: "Handbook", account: null });
    await addDoc({ title: "Nike runbook", account: IDS.nike });
    await addDoc({ title: "Adidas runbook", account: IDS.adidas });
  });

  it("shows a member the department's documents and their own account's, and nobody else's", async () => {
    const anna = await load(IDS.anna); // on Nike
    expect(names(await getDocTree(anna))).toEqual(["Handbook", "Nike runbook"]);
  });

  it("scopes an account director to their own account the same way", async () => {
    const sarah = await load(IDS.sarah); // Nike's director
    expect(names(await getDocTree(sarah))).toEqual(["Handbook", "Nike runbook"]);
  });

  it("shows the senior director everything", async () => {
    const elena = await load(IDS.elena);
    // `names` sorts, so the expectation is alphabetical rather than by scope.
    expect(names(await getDocTree(elena))).toEqual([
      "Adidas runbook",
      "Handbook",
      "Nike runbook",
    ]);
  });

  it("refuses an account document to someone on no account at all", async () => {
    // A senior director has no account; every other accountless account must fall
    // through to org-wide only rather than matching `account_id = null`.
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
    const folder = await addFolder({ name: "Adidas", account: IDS.adidas });
    await addDoc({ title: "Escalation", folder });

    const elena = await load(IDS.elena);
    const tree = await getDocTree(elena);
    expect(tree.folders.map((f) => f.name)).toEqual(["Adidas"]);
    expect(tree.folders[0].documents.map((d) => d.title)).toEqual(["Escalation"]);

    // Anna is on Nike. Neither the folder nor what is in it may appear — a
    // document must not float up to the top level because its folder was
    // filtered out.
    const anna = await load(IDS.anna);
    const hers = await getDocTree(anna);
    expect(hers.folders).toEqual([]);
    expect(hers.documents).toEqual([]);
  });

  it("keeps a document with no folder at the top level", async () => {
    await addDoc({ title: "Holidays", account: null });
    const tree = await getDocTree(await load(IDS.anna));
    expect(tree.documents.map((d) => d.title)).toEqual(["Holidays"]);
    expect(tree.folders).toEqual([]);
  });

  it("nests folders inside folders", async () => {
    const outer = await addFolder({ name: "How we work", account: null });
    const inner = await addFolder({ name: "Escalation", parent: outer });
    await addDoc({ title: "Out of hours", folder: inner });

    const tree = await getDocTree(await load(IDS.anna));
    expect(tree.folders.map((f) => f.name)).toEqual(["How we work"]);
    expect(tree.folders[0].folders.map((f) => f.name)).toEqual(["Escalation"]);
    expect(tree.folders[0].folders[0].documents.map((d) => d.title)).toEqual(["Out of hours"]);
  });

  it("gives what is inside a folder the folder's placement", async () => {
    const folder = await addFolder({ name: "How we work", account: null });
    const doc = await addDoc({ title: "Expenses", account: IDS.adidas, folder });

    const row = await db.query.documents.findFirst({ where: eq(documents.id, doc) });
    expect(row?.visibility).toBe("org");
    expect(row?.accountId).toBeNull();
  });

  it("takes everything with it when a folder is deleted", async () => {
    const outer = await addFolder({ name: "How we work", account: null });
    const inner = await addFolder({ name: "Escalation", parent: outer });
    await addDoc({ title: "Out of hours", folder: inner });
    await addDoc({ title: "Start here", folder: outer });

    await db.delete(folders).where(eq(folders.id, outer));
    expect(await db.select().from(documents)).toHaveLength(0);
    expect(await db.select().from(folders)).toHaveLength(0);
  });

  it("takes an account's folders when the account goes", async () => {
    const folder = await addFolder({ name: "Nike", account: IDS.nike });
    await addDoc({ title: "Runbook", folder });
    // Only folders are under test; the account's other dependants are cleared
    // first so the delete can land.
    await db.execute(`delete from tasks where account_id = '${IDS.nike}'`);
    await db.execute(`delete from boards where account_id = '${IDS.nike}'`);
    await db.execute(`delete from account_members where account_id = '${IDS.nike}'`);
    await db.execute(`update accounts set account_director_id = null where id = '${IDS.nike}'`);
    await db.execute(`delete from accounts where id = '${IDS.nike}'`);

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
    const mine = await addDoc({ title: "Handbook", account: null });
    const theirs = await addDoc({ title: "Adidas runbook", account: IDS.adidas });

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
      account: null,
      body: JSON.stringify([
        {
          type: "paragraph",
          content: [{ type: "text", text: "Escalate to the duty director.", styles: {} }],
        },
      ]),
    });
    await addDoc({
      title: "Adidas escalation",
      account: IDS.adidas,
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
      "Adidas escalation",
      "Handbook",
    ]);
  });

  it("takes a multi-word query as a search rather than a syntax error", async () => {
    await addDoc({ title: "Brand guidelines", account: null });
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
    const brand = await addDoc({ title: "Brand", account: null });
    const tone = await addDoc({ title: "Tone", account: null });
    const task = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });

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
    const anna = await load(IDS.anna); // on Nike
    const theirs = await addDoc({ title: "Adidas runbook", account: IDS.adidas });
    const task = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });

    // A hand-written payload naming another account's document.
    await syncMentionedDocs(
      anna,
      task,
      bodyMentioning("See ", [{ id: theirs, title: "Adidas runbook" }]),
    );

    expect(await db.select().from(taskDocuments)).toHaveLength(0);
  });

  it("lists the tasks pointing back at a document", async () => {
    const anna = await load(IDS.anna);
    const brand = await addDoc({ title: "Brand", account: null });
    const attached = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });
    const mentioned = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 1 });

    await linkDoc(attached, brand, "attached");
    await linkDoc(mentioned, brand, "mentioned");

    const backlinks = await getDocBacklinks(anna, brand);
    expect(backlinks).toHaveLength(2);
    expect(backlinks.find((b) => b.id === attached)?.mentionedOnly).toBe(false);
    expect(backlinks.find((b) => b.id === mentioned)?.mentionedOnly).toBe(true);
  });
});

describe("who can write a document", () => {
  const org = { visibility: "org" as const, accountId: null };
  const nike = { visibility: "account" as const, accountId: IDS.nike };
  const adidas = { visibility: "account" as const, accountId: IDS.adidas };

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

  it("lets a team member write their own account's documents", async () => {
    const anna = await load(IDS.anna); // on Nike, plain member
    expect(canEditDoc(anna, nike)).toBe(true);
    expect(canPlaceDoc(anna, nike)).toBe(true);
  });

  it("still stops them writing another account's", async () => {
    const anna = await load(IDS.anna);
    expect(canEditDoc(anna, adidas)).toBe(false);
    expect(canPlaceDoc(anna, adidas)).toBe(false);
  });

  it("gives the senior director every account", async () => {
    const elena = await load(IDS.elena); // no account of their own
    expect(canPlaceDoc(elena, nike)).toBe(true);
    expect(canPlaceDoc(elena, adidas)).toBe(true);
  });

  it("refuses a member a child of an org-wide document", async () => {
    // A child adopts its parent's scope, so filing under an org-wide document
    // is publishing an org-wide document by another name.
    const anna = await load(IDS.anna);
    expect(canPlaceDoc(anna, org)).toBe(false);
    expect(canPlaceDoc(await load(IDS.sarah), org)).toBe(true);
  });

  it("refuses an account placement with no account behind it", async () => {
    // The check constraint forbids the row; this refuses it a step earlier.
    expect(canPlaceDoc(await load(IDS.sarah), { visibility: "account", accountId: null })).toBe(false);
  });
});
