"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Folder, FolderOpen, Globe, Users } from "lucide-react";
import { cn } from "../lib/utils";
import type { DocFolderData, DocNodeData, DocScope } from "../types";

/**
 * Whose a document is, said once and the same way everywhere. Org-wide is the
 * exception worth marking; a team's own document is the ordinary case and gets
 * the quieter treatment.
 */
export function ScopeBadge({
  scope,
  teamName,
}: {
  scope: DocScope;
  teamName: string | null;
}) {
  const org = scope === "org";
  const Icon = org ? Globe : Users;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 text-caption",
        org ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-700",
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={1.75} />
      {org ? "Everyone" : (teamName ?? "Team")}
    </span>
  );
}

/*
 * Indent by step, not by arithmetic: every value in this system cites a token,
 * and `depth * 16px` cites none. Four steps is also as deep as an indent stays
 * readable — past that the tree is telling you the document is filed too deep,
 * and the breadcrumb is the better answer.
 */
/*
 * Indent by step, not by arithmetic: every value in this system cites a token,
 * and `depth * 16px` cites none. Four steps is also as deep as an indent stays
 * readable — past that the tree is telling you the thing is filed too deep,
 * and the breadcrumb is the better answer.
 */
const INDENT = ["pl-0", "pl-4", "pl-8", "pl-12"] as const;
const indentAt = (depth: number) => INDENT[Math.min(depth, INDENT.length - 1)];

const rowStyles = "flex items-center gap-1 rounded-md pr-1 transition-colors";

function DocRow({
  doc,
  activeId,
  depth,
}: {
  doc: DocNodeData;
  activeId?: string;
  depth: number;
}) {
  const active = doc.id === activeId;
  return (
    <li>
      <div
        className={cn(
          rowStyles,
          active ? "bg-blue-100" : "hover:bg-gray-100",
          indentAt(depth),
        )}
      >
        {/* No chevron: a document holds no documents, so there is nothing to
            open. The gap keeps every title on one left edge. */}
        <span aria-hidden className="size-5 shrink-0" />
        <Link
          href={doc.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-body",
            active ? "text-blue-900" : "text-gray-1000",
          )}
        >
          <FileText className="size-4 shrink-0 text-gray-600" strokeWidth={1.75} />
          <span className="truncate">{doc.title}</span>
        </Link>
      </div>
    </li>
  );
}

function FolderRow({
  folder,
  activeId,
  depth,
}: {
  folder: DocFolderData;
  activeId?: string;
  depth: number;
}) {
  const holdsSomething = folder.folders.length > 0 || folder.documents.length > 0;
  const inSubtree = contains(folder, activeId);
  const active = folder.id === activeId;

  /*
   * null means "follow the route" — the branch holding what you are looking at
   * is open, and closes when you leave it. Working the chevron makes it your
   * choice from then on, which is what a disclosure you operated yourself is
   * expected to do. The same rule the rail groups follow.
   */
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? inSubtree;

  return (
    <li>
      <div
        className={cn(
          rowStyles,
          active ? "bg-blue-100" : "hover:bg-gray-100",
          indentAt(depth),
        )}
      >
        {holdsSomething ? (
          <button
            type="button"
            onClick={() => setOpen(!expanded)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${folder.name}`}
            className="rounded-md p-0.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-1000"
          >
            <ChevronRight
              className={cn("size-4 transition-transform", expanded && "rotate-90")}
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <span aria-hidden className="size-5 shrink-0" />
        )}

        {/* The name navigates and the chevron discloses — a row that does both
            makes one of them a surprise. */}
        <Link
          href={folder.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-body-strong",
            active ? "text-blue-900" : "text-gray-1000",
          )}
        >
          {expanded && holdsSomething ? (
            <FolderOpen className="size-4 shrink-0 text-gray-700" strokeWidth={1.75} />
          ) : (
            <Folder className="size-4 shrink-0 text-gray-700" strokeWidth={1.75} />
          )}
          <span className="truncate">{folder.name}</span>
        </Link>

        {depth === 0 ? <ScopeBadge scope={folder.scope} teamName={folder.teamName} /> : null}
      </div>

      {holdsSomething && expanded ? (
        <ul>
          {folder.folders.map((child) => (
            <FolderRow key={child.id} folder={child} activeId={activeId} depth={depth + 1} />
          ))}
          {folder.documents.map((doc) => (
            <DocRow key={doc.id} doc={doc} activeId={activeId} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function contains(folder: DocFolderData, id?: string): boolean {
  if (!id) return false;
  if (folder.id === id) return true;
  if (folder.documents.some((d) => d.id === id)) return true;
  return folder.folders.some((f) => contains(f, id));
}

/**
 * Folders, and the documents in them.
 *
 * Folders come before documents at every level: a folder is a place and a
 * document is a thing, and a list reads better when the places are together.
 * The scope badge sits on roots only — visibility belongs to a subtree, so
 * repeating it on every child would be four ways of saying one thing.
 */
export function DocTree({
  folders,
  documents,
  activeId,
  empty = "Nothing here yet.",
}: {
  folders: DocFolderData[];
  /** Documents at this level — the top of the tree, or a folder's own. */
  documents: DocNodeData[];
  activeId?: string;
  empty?: string;
}) {
  if (folders.length === 0 && documents.length === 0) {
    return (
      <p className="rounded-lg border border-gray-400 bg-background-100 px-4 py-6 text-body text-gray-600">
        {empty}
      </p>
    );
  }

  return (
    <ul className="rounded-lg border border-gray-400 bg-background-100 p-2">
      {folders.map((folder) => (
        <FolderRow key={folder.id} folder={folder} activeId={activeId} depth={0} />
      ))}
      {documents.map((doc) => (
        <DocRow key={doc.id} doc={doc} activeId={activeId} depth={0} />
      ))}
    </ul>
  );
}

/** The folders above this, root first — where you are, and how you got here. */
export function DocBreadcrumb({
  trail,
  current,
}: {
  trail: { id: string; name: string; href: string }[];
  /** The thing you are looking at. It is where you are, so it is not a link. */
  current: string;
}) {
  /*
   * Always rendered, even at the top of the tree. A root folder has nothing
   * above it but "Docs", and that is exactly the case where a way back up
   * matters most — bailing out on an empty trail left the first level of the
   * browser with no way out except the rail.
   */
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-caption">
      <Link href="/docs" className="text-blue-700 hover:text-blue-800">
        Docs
      </Link>
      {trail.map((step) => (
        <span key={step.id} className="flex items-center gap-1">
          <span className="text-gray-600">/</span>
          <Link href={step.href} className="text-blue-700 hover:text-blue-800">
            {step.name}
          </Link>
        </span>
      ))}
      <span className="text-gray-600">/</span>
      <span className="text-gray-700">{current}</span>
    </nav>
  );
}
