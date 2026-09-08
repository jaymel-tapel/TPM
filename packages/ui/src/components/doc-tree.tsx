"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Globe, Users } from "lucide-react";
import { cn } from "../lib/utils";
import type { DocNodeData, DocScope } from "../types";

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
const INDENT = ["pl-0", "pl-4", "pl-8", "pl-12"] as const;

function TreeNode({
  node,
  activeId,
  depth,
}: {
  node: DocNodeData;
  activeId?: string;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  const inSubtree = containsId(node, activeId);

  /*
   * null means "follow the route" — the branch holding the open document is
   * open, and closes when you leave it. Working the chevron makes it your
   * choice from then on, which is what a disclosure you operated yourself is
   * expected to do. The same rule the rail groups follow.
   */
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? inSubtree;
  const active = node.id === activeId;

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pr-1 transition-colors",
          active ? "bg-blue-100" : "hover:bg-gray-100",
          INDENT[Math.min(depth, INDENT.length - 1)],
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen(!expanded)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.title}`}
            className="rounded-md p-0.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-1000"
          >
            <ChevronRight
              className={cn("size-4 transition-transform", expanded && "rotate-90")}
              strokeWidth={1.75}
            />
          </button>
        ) : (
          // Keeps titles on one left edge whether or not a row can open.
          <span aria-hidden className="size-5 shrink-0" />
        )}

        <Link
          href={node.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-body",
            active ? "text-blue-900" : "text-gray-1000",
          )}
        >
          <FileText className="size-4 shrink-0 text-gray-600" strokeWidth={1.75} />
          <span className="truncate">{node.title}</span>
        </Link>

        {depth === 0 ? <ScopeBadge scope={node.scope} teamName={node.teamName} /> : null}
      </div>

      {hasChildren && expanded ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} activeId={activeId} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function containsId(node: DocNodeData, id?: string): boolean {
  if (!id) return false;
  if (node.id === id) return true;
  return node.children.some((child) => containsId(child, id));
}

/**
 * The whole set of documents, as the tree it is.
 *
 * The scope badge sits on roots only: visibility belongs to a subtree, so
 * repeating it on every child would be four ways of saying one thing.
 */
export function DocTree({
  nodes,
  activeId,
}: {
  nodes: DocNodeData[];
  activeId?: string;
}) {
  if (nodes.length === 0) {
    return (
      <p className="rounded-lg border border-gray-400 bg-background-100 px-4 py-6 text-body text-gray-600">
        No documents yet.
      </p>
    );
  }

  return (
    <ul className="rounded-lg border border-gray-400 bg-background-100 p-2">
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} activeId={activeId} depth={0} />
      ))}
    </ul>
  );
}

/** Root first, this document last — where you are, and how you got here. */
export function DocBreadcrumb({
  trail,
}: {
  trail: { id: string; title: string; href: string }[];
}) {
  if (trail.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-caption">
      {trail.map((step, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={step.id} className="flex items-center gap-1">
            {last ? (
              <span className="text-gray-700">{step.title}</span>
            ) : (
              <Link href={step.href} className="text-blue-700 hover:text-blue-800">
                {step.title}
              </Link>
            )}
            {last ? null : <span className="text-gray-600">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
