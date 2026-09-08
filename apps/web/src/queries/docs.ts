import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { DocVisibility, User } from "@/db/schema";

/** A document as every screen renders it, with its link already resolved. */
export type DocSummary = {
  id: string;
  title: string;
  href: string;
  visibility: DocVisibility;
  teamId: string | null;
  teamName: string | null;
  folderId: string | null;
  updatedAt: Date;
};

export type DocDetail = DocSummary & {
  body: string | null;
  authorName: string;
  /** The folders above it, root first. Empty for one at the top level. */
  trail: { id: string; name: string; href: string }[];
};

/** A folder, as the tree and the pickers render it. */
export type FolderSummary = {
  id: string;
  name: string;
  href: string;
  visibility: DocVisibility;
  teamId: string | null;
  teamName: string | null;
  parentId: string | null;
};

export type FolderDetail = FolderSummary & {
  /** Root first, this folder last. */
  trail: { id: string; name: string; href: string }[];
};

/**
 * A folder and everything under it. Folders nest and documents sit inside
 * them, so a node has both — the tree is one shape, not two interleaved.
 */
export type DocTreeNode = FolderSummary & {
  folders: DocTreeNode[];
  documents: DocSummary[];
};

/** A run of snippet text, and whether it matched. */
export type SnippetRun = { text: string; hit: boolean };

/** A search hit. `snippet` arrives split into runs — never a string of markup. */
export type DocSearchHit = DocSummary & { snippet: SnippetRun[] };

/** One row of the `@` picker. */
export type MentionOption = { id: string; title: string; subtitle: string };

/** A task that references a document, for the backlink list. */
export type DocBacklink = {
  id: string;
  title: string;
  href: string;
  statusName: string;
  statusKind: "open" | "done" | "blocked";
  done: boolean;
  /** Whether the task attached it deliberately or only mentions it in prose. */
  mentionedOnly: boolean;
};

/** A document referenced by a task, as the task screens show it. */
export type DocRef = {
  id: string;
  title: string;
  href: string;
  visibility: DocVisibility;
  teamName: string | null;
  attached: boolean;
  mentioned: boolean;
};

/**
 * What this person is allowed to see, as one composable fragment — the same
 * discipline as `scopeSql`, so the tree, the search and the `@` picker can
 * never disagree about who sees what. Applied to a `documents` row aliased `d`.
 */
export function docScopeSql(viewer: User): SQL {
  if (viewer.role === "senior_director") return sql`true`;
  return viewer.teamId
    ? sql`(d.visibility = 'org' or d.team_id = ${viewer.teamId})`
    : sql`d.visibility = 'org'`;
}

/** The same rule as `docScopeSql`, applied to a `folders` row aliased `f`. */
export function folderScopeSql(viewer: User): SQL {
  if (viewer.role === "senior_director") return sql`true`;
  return viewer.teamId
    ? sql`(f.visibility = 'org' or f.team_id = ${viewer.teamId})`
    : sql`f.visibility = 'org'`;
}

const summarySelect = sql`
  d.id, d.title, d.visibility, d.team_id as "teamId", t.name as "teamName",
  d.folder_id as "folderId", d.updated_at as "updatedAt"
`;

const folderSelect = sql`
  f.id, f.name, f.visibility, f.team_id as "teamId", t.name as "teamName",
  f.parent_id as "parentId"
`;

const folderFrom = sql`
  from folders f
  left join teams t on t.id = f.team_id
`;

const withFolderHref = <T extends { id: string }>(row: T) => ({
  ...row,
  href: `/docs/folders/${row.id}`,
});

const summaryFrom = sql`
  from documents d
  left join teams t on t.id = d.team_id
`;

const withHref = <T extends { id: string }>(row: T) => ({
  ...row,
  href: `/docs/${row.id}`,
});

/**
 * Everything this person may see, as one tree of folders with their documents
 * inside.
 *
 * Read flat and assembled here rather than with a recursive CTE: visibility is
 * a property of the whole tree, so a viewer either sees a folder and what is
 * under it or sees none of it, and one pass over the rows is cheaper than
 * teaching Postgres the same thing. A folder whose parent is missing is
 * dropped rather than promoted — where a thing sits is part of what it means.
 */
export async function getDocTree(viewer: User): Promise<{
  folders: DocTreeNode[];
  documents: DocSummary[];
}> {
  const [folderRows, docRows] = await Promise.all([
    db.execute(sql`
      select ${folderSelect} ${folderFrom}
      where ${folderScopeSql(viewer)}
      order by f.position asc, f.name asc
    `),
    db.execute(sql`
      select ${summarySelect} ${summaryFrom}
      where ${docScopeSql(viewer)}
      order by d.position asc, d.title asc
    `),
  ]);

  const byId = new Map<string, DocTreeNode>();
  for (const row of folderRows.rows as unknown as Omit<FolderSummary, "href">[]) {
    byId.set(row.id, { ...withFolderHref(row), folders: [], documents: [] });
  }

  const roots: DocTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (node.parentId && !parent) continue;
    (parent ? parent.folders : roots).push(node);
  }

  // Documents with no folder sit at the top level, beside the root folders.
  const loose: DocSummary[] = [];
  for (const row of docRows.rows as unknown as Omit<DocSummary, "href">[]) {
    const doc = withHref(row);
    const folder = doc.folderId ? byId.get(doc.folderId) : undefined;
    if (doc.folderId && !folder) continue;
    (folder ? folder.documents : loose).push(doc);
  }

  return { folders: roots, documents: loose };
}

/** Folders this person may see, flat — for the "which folder" picker. */
export async function listFolderOptions(
  viewer: User,
  excludeSubtreeOf?: string,
): Promise<FolderSummary[]> {
  const result = await db.execute(sql`
    with recursive subtree as (
      select f.id from folders f where f.id = ${excludeSubtreeOf ?? null}::uuid
      union all
      select c.id from folders c join subtree s on c.parent_id = s.id
    )
    select ${folderSelect} ${folderFrom}
    where ${folderScopeSql(viewer)}
      and f.id not in (select id from subtree)
    order by f.name asc
  `);
  return (result.rows as unknown as Omit<FolderSummary, "href">[]).map(withFolderHref);
}

/** A folder's own row, plus the folders above it. */
export async function getFolder(
  viewer: User,
  folderId: string,
): Promise<FolderDetail | null> {
  const result = await db.execute(sql`
    with recursive trail as (
      select f.id, f.parent_id, f.name, 0 as depth
      from folders f where f.id = ${folderId}::uuid
      union all
      select p.id, p.parent_id, p.name, tr.depth + 1
      from folders p join trail tr on p.id = tr.parent_id
    )
    select ${folderSelect},
      (select coalesce(
         jsonb_agg(jsonb_build_object('id', tr.id, 'name', tr.name) order by tr.depth desc),
         '[]'::jsonb)
       from trail tr) as trail
    ${folderFrom}
    where f.id = ${folderId}::uuid and ${folderScopeSql(viewer)}
  `);
  const row = (result.rows as unknown as (Omit<FolderDetail, "href" | "trail"> & {
    trail: { id: string; name: string }[];
  })[])[0];
  if (!row) return null;

  return {
    ...withFolderHref(row),
    trail: row.trail.map((step) => ({ ...step, href: `/docs/folders/${step.id}` })),
  };
}

/** What is directly inside a folder: its subfolders, then its documents. */
export async function listFolderContents(
  viewer: User,
  folderId: string,
): Promise<{ folders: FolderSummary[]; documents: DocSummary[] }> {
  const [folderRows, docRows] = await Promise.all([
    db.execute(sql`
      select ${folderSelect} ${folderFrom}
      where ${folderScopeSql(viewer)} and f.parent_id = ${folderId}::uuid
      order by f.position asc, f.name asc
    `),
    db.execute(sql`
      select ${summarySelect} ${summaryFrom}
      where ${docScopeSql(viewer)} and d.folder_id = ${folderId}::uuid
      order by d.position asc, d.title asc
    `),
  ]);
  return {
    folders: (folderRows.rows as unknown as Omit<FolderSummary, "href">[]).map(withFolderHref),
    documents: (docRows.rows as unknown as Omit<DocSummary, "href">[]).map(withHref),
  };
}

export async function getDoc(viewer: User, docId: string): Promise<DocDetail | null> {
  const result = await db.execute(sql`
    with recursive trail as (
      select f.id, f.parent_id, f.name, 0 as depth
      from folders f
      where f.id = (select folder_id from documents where id = ${docId}::uuid)
      union all
      select p.id, p.parent_id, p.name, tr.depth + 1
      from folders p join trail tr on p.id = tr.parent_id
    )
    select ${summarySelect}, d.body, u.name as "authorName",
      (select coalesce(
         jsonb_agg(jsonb_build_object('id', tr.id, 'name', tr.name) order by tr.depth desc),
         '[]'::jsonb)
       from trail tr) as trail
    ${summaryFrom}
    join users u on u.id = d.created_by
    where d.id = ${docId}::uuid and ${docScopeSql(viewer)}
  `);
  const row = (result.rows as unknown as (Omit<DocDetail, "href" | "trail"> & {
    trail: { id: string; name: string }[];
  })[])[0];
  if (!row) return null;

  return {
    ...withHref(row),
    trail: row.trail.map((step) => ({ ...step, href: `/docs/folders/${step.id}` })),
  };
}

/**
 * Full-text over the title and the flattened body.
 *
 * The `to_tsvector` expression has to match `documents_search_idx` in
 * `0003_amazing_joseph.sql` character for character or Postgres quietly falls
 * back to a sequential scan. `websearch_to_tsquery` rather than `to_tsquery`
 * so that typing two words, or a stray quote, is a search rather than a
 * syntax error.
 */
export async function searchDocs(
  viewer: User,
  query: string,
  limit = 20,
): Promise<DocSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const vector = sql`to_tsvector('english', d.title || ' ' || d.search_text)`;
  const tsquery = sql`websearch_to_tsquery('english', ${q})`;

  const result = await db.execute(sql`
    select ${summarySelect},
      ts_headline('english',
        case when d.search_text = '' then d.title else d.search_text end,
        ${tsquery},
        ${`StartSel=${HIT_OPEN},StopSel=${HIT_CLOSE},MaxFragments=1,MaxWords=28,MinWords=10`}
      ) as snippet
    ${summaryFrom}
    where ${docScopeSql(viewer)} and ${vector} @@ ${tsquery}
    order by ts_rank(${vector}, ${tsquery}) desc, d.updated_at desc
    limit ${limit}
  `);

  const rows = result.rows as unknown as (Omit<DocSearchHit, "href" | "snippet"> & {
    snippet: string;
  })[];
  return rows.map((row) => ({ ...withHref(row), snippet: splitSnippet(row.snippet) }));
}

/*
 * `ts_headline` marks the matched words for us, but what it hands back is the
 * author's own prose with markers pushed into it. Prose that arrives as a
 * string is never rendered as markup, so the markers are two control
 * characters — which cannot occur in a document — and they are split back out
 * into runs here. The design system styles runs; it is never handed HTML.
 */
const HIT_OPEN = "\u0002";
const HIT_CLOSE = "\u0003";

function splitSnippet(raw: string): SnippetRun[] {
  const runs: SnippetRun[] = [];
  for (const chunk of raw.split(HIT_OPEN)) {
    const [hit, ...rest] = chunk.split(HIT_CLOSE);
    if (rest.length === 0) {
      if (hit) runs.push({ text: hit, hit: false });
      continue;
    }
    if (hit) runs.push({ text: hit, hit: true });
    const tail = rest.join(HIT_CLOSE);
    if (tail) runs.push({ text: tail, hit: false });
  }
  return runs;
}

/** Documents a task references, however it came to reference them. */
export async function getLinkedDocs(viewer: User, taskId: string): Promise<DocRef[]> {
  const result = await db.execute(sql`
    select d.id, d.title, d.visibility, t.name as "teamName",
      bool_or(td.source = 'attached') as attached,
      bool_or(td.source = 'mentioned') as mentioned
    from task_documents td
    join documents d on d.id = td.document_id
    left join teams t on t.id = d.team_id
    where td.task_id = ${taskId}::uuid and ${docScopeSql(viewer)}
    group by d.id, d.title, d.visibility, t.name
    order by d.title asc
  `);
  return (result.rows as unknown as Omit<DocRef, "href">[]).map(withHref);
}

/** Every task pointing at this document — the other half of a reference. */
export async function getDocBacklinks(viewer: User, docId: string): Promise<DocBacklink[]> {
  const result = await db.execute(sql`
    select k.id, k.title, s.name as "statusName", s.kind as "statusKind",
      (k.completed_at is not null) as done,
      not bool_or(td.source = 'attached') as "mentionedOnly"
    from task_documents td
    join tasks k on k.id = td.task_id
    join board_statuses s on s.id = k.status_id
    where td.document_id = ${docId}::uuid
      and ${
        viewer.role === "senior_director"
          ? sql`true`
          : sql`(k.team_id = ${viewer.teamId ?? null}::uuid
                 or exists (select 1 from task_assignees sa
                            where sa.task_id = k.id and sa.user_id = ${viewer.id}))`
      }
    group by k.id, k.title, s.name, s.kind, k.completed_at
    order by (k.completed_at is not null) asc, k.due_date asc
  `);
  return (result.rows as unknown as Omit<DocBacklink, "href">[]).map((row) => ({
    ...row,
    href: `/tasks/${row.id}`,
  }));
}

/**
 * Narrows a list of document ids to the ones this person may actually see.
 *
 * Mentions arrive inside a form payload, so their ids are user input however
 * they got there. Everything that turns a mention into a row goes through here
 * first — otherwise a hand-written description could link a task to a document
 * its author was never shown.
 */
export async function filterVisibleDocIds(viewer: User, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  // Expanded into placeholders rather than bound as one array: the driver
  // sends a JS array as a single parameter, which Postgres then tries to read
  // as an array literal and refuses.
  const list = sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const result = await db.execute(sql`
    select d.id from documents d
    where d.id in (${list}) and ${docScopeSql(viewer)}
  `);
  return (result.rows as unknown as { id: string }[]).map((r) => r.id);
}

/**
 * Every document this person could mention, titles only.
 *
 * Deliberately unfiltered and unpaged: the client holds the list and matches
 * against it as you type, so this runs once per form rather than once per
 * keystroke. `subtitle` says whose it is, which is the only thing that
 * distinguishes two documents with the same name.
 */
export async function listMentionableFor(viewer: User): Promise<MentionOption[]> {
  const result = await db.execute(sql`
    select d.id, d.title, coalesce(t.name, 'Everyone') as subtitle
    ${summaryFrom}
    where ${docScopeSql(viewer)}
    order by d.title asc
    limit 500
  `);
  return result.rows as unknown as MentionOption[];
}
