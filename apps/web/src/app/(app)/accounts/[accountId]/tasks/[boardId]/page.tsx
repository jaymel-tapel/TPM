import { Columns3, List, Plus, Settings2, User } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  EmptyState,
  PageHeader,
  TASK_TYPE_LABELS,
  TASK_TYPES,
  TaskBoard,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { notFound } from "next/navigation";
import { openAccount } from "@/lib/account-page";
import { canViewAccount } from "@/lib/permissions";
import { getBoardView, listBoardsForAccounts } from "@/queries/tasks";
import { listCampaignOptions } from "@/queries/campaigns";
import { listAccountMembers } from "@/queries/accounts";
import { toBoard, toTaskRow } from "@/lib/present";
import { setTaskStatus, toggleTaskDone } from "@/actions/tasks";
import { FilterBar, FilterSelect } from "@/components/filter-bar";
import type { TaskType } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * An account's work.
 *
 * There is no Boards *section* — a board is not a place beside the client it
 * belongs to. It is which set of columns this page is drawn with, and there is
 * more than one because a client's creative pipeline and its media pipeline do
 * not share stages. So the boards live under Tasks in the rail, and **Board is
 * a way of looking at the work**, alongside List.
 *
 * One board at a time, deliberately. Two boards have two sets of columns and
 * there is no honest way to draw both at once.
 */
export default async function AccountBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string; boardId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accountId, boardId } = await params;
  const { user, zone, account } = await openAccount(accountId);

  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : "";
  };
  const asList = one("view") === "list";
  const mineOnly = one("mine") === "1";
  const campaignId = one("campaign");
  const type = one("type");

  /*
   * The board has to belong to *this* account. It arrives in the path, so a
   * board id from another client would otherwise render that client's work
   * under this one's name — past a guard that only checked the account.
   */
  const boards = await listBoardsForAccounts([accountId]);
  const board = boards.find((b) => b.id === boardId);
  if (!board) notFound();

  const [view, campaigns, people] = await Promise.all([
    getBoardView(
      board.id,
      undefined,
      {
        assigneeId: mineOnly ? user.id : null,
        campaignId: campaignId || null,
        // Straight off the URL, so it is checked against the fixed set rather
        // than pasted into SQL as whatever the address bar happened to say.
        type: (TASK_TYPES as readonly string[]).includes(type) ? (type as TaskType) : null,
      },
      zone,
    ),
    listCampaignOptions(accountId),
    listAccountMembers(accountId),
  ]);
  if (!view) notFound();

  /** Keeps whichever settings you are not currently changing. */
  const href = (next: Partial<{ list: boolean; mine: boolean }>) => {
    const params = new URLSearchParams();
    if (next.list ?? asList) params.set("view", "list");
    if (next.mine ?? mineOnly) params.set("mine", "1");
    if (campaignId) params.set("campaign", campaignId);
    if (type) params.set("type", type);
    const search = params.toString();
    return `/accounts/${accountId}/tasks/${boardId}${search ? `?${search}` : ""}`;
  };

  const filtered = Boolean(mineOnly || campaignId || type);

  return (
    <>
      {/* The client, then the board. "Tasks" is the rail's word for the group;
          the page itself is one board, and saying which is the useful half. */}
      <PageHeader eyebrow={account.name} title={board.name} />

      <CommandBar className="mb-4">
        <Command icon={List} href={href({ list: true })} active={asList}>
          List
        </Command>
        <Command icon={Columns3} href={href({ list: false })} active={!asList}>
          Board
        </Command>
        <CommandDivider />
        {/* A filter, not a third view — it narrows whichever view is showing. */}
        <Command icon={User} href={href({ mine: !mineOnly })} active={mineOnly}>
          My Tasks
        </Command>

        <div className="ml-auto flex items-center gap-1">
          {canViewAccount(user, accountId) ? (
            <>
              <Command
                icon={Settings2}
                href={`/accounts/${accountId}/tasks/${boardId}/columns`}
              >
                Columns
              </Command>
              <CommandDivider />
            </>
          ) : null}
          <Command icon={Plus} href="/tasks/new" tone="primary">
            New Task
          </Command>
        </div>
      </CommandBar>

      <FilterBar>
        <FilterSelect
          name="campaign"
          value={campaignId}
          all="All campaigns"
          options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          name="mine"
          value={mineOnly ? "1" : ""}
          all="All people"
          options={people.map((p) => ({
            value: p.id === user.id ? "1" : p.id,
            label: p.id === user.id ? "Just me" : p.name,
          }))}
        />
        <FilterSelect
          name="type"
          value={type}
          all="Any task type"
          options={TASK_TYPES.map((t) => ({ value: t, label: TASK_TYPE_LABELS[t] }))}
        />
      </FilterBar>

      <div className="mt-6">
        {view.columns.length === 0 ? (
          <EmptyState>This account has no columns yet.</EmptyState>
        ) : view.total === 0 ? (
          <EmptyState>
            {filtered ? "Nothing matches those filters today." : "Nothing due here today."}
          </EmptyState>
        ) : asList ? (
          <div className="space-y-8">
            {view.columns
              .filter((column) => column.tasks.length > 0)
              .map((column) => (
                <TaskList
                  key={column.id}
                  title={column.name}
                  tone={
                    column.kind === "blocked"
                      ? "danger"
                      : column.kind === "done"
                        ? "quiet"
                        : "default"
                  }
                >
                  {column.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={toTaskRow(task)}
                      onToggle={toggleTaskDone}
                      quiet={column.kind === "done"}
                    />
                  ))}
                </TaskList>
              ))}
          </div>
        ) : (
          <TaskBoard board={toBoard(view)} onMove={setTaskStatus} moreHref={href({ list: true })} />
        )}
      </div>
    </>
  );
}
