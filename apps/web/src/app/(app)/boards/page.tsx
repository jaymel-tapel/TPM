import Link from "next/link";
import { redirect } from "next/navigation";
import { Columns3 } from "lucide-react";
import { EmptyState, PageHeader, Panel, SectionHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { listBoardsForUser } from "@/queries/tasks";

export const dynamic = "force-dynamic";

/**
 * One board is a place; several are a list.
 *
 * This used to redirect everybody but the Senior Director straight to their
 * first board, on the reasoning that most people had exactly one. Working
 * across accounts broke that: a designer on two clients and a director on
 * three now have several, and "the first one" is not a place anybody meant to
 * go. So the redirect survives only where it is still true.
 */
export default async function BoardsPage() {
  const { user } = await requireSession();
  const boards = await listBoardsForUser(user);

  if (!isSenior(user) && boards.length <= 1) {
    if (boards[0]) redirect(`/boards/${boards[0].id}`);
    return (
      <>
        <PageHeader title="Boards" subtitle="Work lives on a board." />
        <EmptyState>
          No boards yet. An Account Director creates them for their account.
        </EmptyState>
      </>
    );
  }

  // Grouped in the order the query returns them, which is by account then name.
  const byAccount = new Map<string, { accountName: string; boards: typeof boards }>();
  for (const board of boards) {
    // The department's own boards group under one heading of their own rather
    // than being filed under an account they do not belong to.
    const key = board.accountId ?? "department";
    const label = board.accountName ?? "Department";
    const group = byAccount.get(key);
    if (group) group.boards.push(board);
    else byAccount.set(key, { accountName: label, boards: [board] });
  }

  return (
    <>
      <PageHeader
        title="Boards"
        subtitle={
          isSenior(user)
            ? "Every account's work, and who it belongs to."
            : "The boards you can reach, by the account that owns them."
        }
      />

      {boards.length === 0 ? (
        <EmptyState>
          No boards yet. An Account Director creates them for their account.
        </EmptyState>
      ) : (
        [...byAccount.values()].map((group) => (
          <div key={group.accountName} className="mb-10">
            <SectionHeader
              aside={`${group.boards.length} ${group.boards.length === 1 ? "board" : "boards"}`}
            >
              {group.accountName}
            </SectionHeader>
            <Panel>
              <ul className="divide-y divide-gray-300">
                {group.boards.map((board) => (
                  <li key={board.id}>
                    <Link
                      href={`/boards/${board.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-100"
                    >
                      <Columns3 className="size-4 shrink-0 text-gray-600" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate text-body-strong text-gray-1000">
                        {board.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        ))
      )}
    </>
  );
}
