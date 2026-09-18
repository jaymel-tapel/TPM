import { Columns3, Flag, List, Plus, Settings2, Shapes, Tag, User } from "lucide-react";
import Link from "next/link";
import {
  Command,
  CommandBar,
  CommandDivider,
  EmptyState,
  FilterMenu,
  PageHeader,
  PRIORITY_LABELS,
  PriorityIcon,
  TagBadge,
  TaskBoard,
  TaskList,
  TaskRow,
  TypeLabel,
  type FilterOption,
  type Priority,
} from "@tpm/ui";
import { notFound } from "next/navigation";
import { openAccount } from "@/lib/account-page";
import { canViewAccount } from "@/lib/permissions";
import { getBoardView, listBoardTags, listBoardsForAccounts } from "@/queries/tasks";
import { listAccountMembers } from "@/queries/accounts";
import { listTaskTypes, toTypeRef } from "@/queries/task-types";
import { toBoard, toTaskRow } from "@/lib/present";
import { moveTask, toggleTaskDone } from "@/actions/tasks";

export const dynamic = "force-dynamic";

/**
 * Everything the URL says about how to read this board. One object, because
 * six controls each have to preserve the other five, and doing that by hand
 * six times is how a filter quietly starts dropping the view you were on.
 */
type BoardQuery = {
  list: boolean;
  person?: string;
  type?: string;
  priority?: string;
  tag?: string;
};

/** A search param can arrive repeated. The first one is the answer. */
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;

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
  const current: BoardQuery = {
    list: one(query.view) === "list",
    person: one(query.person),
    type: one(query.type),
    priority: one(query.priority),
    tag: one(query.tag),
  };
  const asList = current.list;
  const narrowed = Boolean(
    current.person || current.type || current.priority || current.tag,
  );

  /*
   * The board has to belong to *this* account. It arrives in the path, so a
   * board id from another client would otherwise render that client's work
   * under this one's name — past a guard that only checked the account.
   */
  const [boards, types] = await Promise.all([
    listBoardsForAccounts([accountId]),
    listTaskTypes(),
  ]);
  const board = boards.find((b) => b.id === boardId);
  if (!board) notFound();

  /*
   * A kind that is not on offer is not a filter, it is a stale link — a
   * bookmark kept past a rename, or a retirement. Dropped here rather than
   * passed on, because the query would match nothing and the menu would show
   * nothing chosen: an empty board with no visible reason for being empty.
   */
  const type = current.type && types.some((t) => t.slug === current.type) ? current.type : undefined;

  const [view, people, boardTags] = await Promise.all([
    getBoardView(
      board.id,
      undefined,
      {
        assigneeId: current.person ?? null,
        type,
        priority: current.priority,
        tag: current.tag,
      },
      zone,
    ),
    listAccountMembers(accountId),
    listBoardTags(board.id),
  ]);
  if (!view) notFound();

  /** Keeps every setting you are not currently changing. */
  const href = (change: Partial<BoardQuery> = {}) => {
    const next = { ...current, ...change };
    const params = new URLSearchParams();
    if (next.list) params.set("view", "list");
    if (next.person) params.set("person", next.person);
    if (next.type) params.set("type", next.type);
    if (next.priority) params.set("priority", next.priority);
    if (next.tag) params.set("tag", next.tag);
    const search = params.toString();
    return `/accounts/${accountId}/tasks/${boardId}${search ? `?${search}` : ""}`;
  };

  /** Back to the whole board, keeping only which of the two views you are on. */
  const unfiltered = href({
    person: undefined,
    type: undefined,
    priority: undefined,
    tag: undefined,
  });


  const personOptions: FilterOption[] = people.map((p) => ({
    value: p.id,
    label: p.id === user.id ? "Just me" : p.name,
    short: p.id === user.id ? "Just me" : p.name,
    href: href({ person: p.id }),
  }));

  /*
   * From the table, in the order somebody arranged it — the same list the task
   * form offers, so you cannot filter for a kind nothing can be given.
   */
  const typeOptions: FilterOption[] = types.map(toTypeRef).map((type) => ({
    value: type.slug,
    label: <TypeLabel type={type} />,
    short: type.label,
    href: href({ type: type.slug }),
  }));

  const priorityOptions: FilterOption[] = (["urgent", "high"] as Priority[]).map((priority) => ({
    value: priority,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <PriorityIcon priority={priority} className="text-red-700" />
        {PRIORITY_LABELS[priority]}
      </span>
    ),
    short: PRIORITY_LABELS[priority],
    href: href({ priority }),
  }));

  const tagOptions: FilterOption[] = boardTags.map((tag) => ({
    value: tag,
    label: <TagBadge>{tag}</TagBadge>,
    short: tag,
    href: href({ tag }),
  }));

  return (
    <>
      {/* The client, then the board. "Tasks" is the rail's word for the group;
          the page itself is one board, and saying which is the useful half. */}
      <PageHeader eyebrow={account.name} title={board.name} />

      {/*
        One bar: how to look at the board, then how to narrow it, then what to
        do to it. The filters were on a row of their own, which read as a
        second toolbar for a job the first one was already doing — and the
        divider between the two groups says more about the difference than a
        line break did.

        "My Tasks" used to sit here as a shortcut. It wrote the same `person`
        the Assignee menu writes, so it was a second control for one fact, and
        the moment Assignee could name anybody it was also the *narrower* of
        the two. Gone: pick yourself from Assignee.
      */}
      <CommandBar className="mb-6">
        <Command icon={List} href={href({ list: true })} active={asList}>
          List
        </Command>
        <Command icon={Columns3} href={href({ list: false })} active={!asList}>
          Board
        </Command>
        <CommandDivider />

        <FilterMenu
          label="Assignee"
          icon={User}
          options={personOptions}
          value={current.person}
          clearHref={href({ person: undefined })}
          empty="Nobody is on this account yet"
        />
        <FilterMenu
          label="Type"
          icon={Shapes}
          options={typeOptions}
          value={current.type}
          clearHref={href({ type: undefined })}
        />
        <FilterMenu
          label="Priority"
          icon={Flag}
          options={priorityOptions}
          value={current.priority}
          clearHref={href({ priority: undefined })}
        />
        <FilterMenu
          label="Tag"
          icon={Tag}
          options={tagOptions}
          value={current.tag}
          clearHref={href({ tag: undefined })}
          empty="Nothing on this board is tagged"
        />

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
          {/* Carrying the board, so a task started here is filed here. */}
          <Command icon={Plus} href={`/tasks/new?board=${boardId}`} tone="primary">
            New Task
          </Command>
        </div>
      </CommandBar>

      <div>
        {view.columns.length === 0 ? (
          <EmptyState>This account has no columns yet.</EmptyState>
        ) : view.total === 0 ? (
          /*
            One message rather than one per combination. Which filters are on is
            already legible in the row above, so saying it again here would only
            be a longer sentence; what is worth adding is the way out.
          */
          <EmptyState>
            {narrowed ? (
              <>
                Nothing on this board matches these filters.{" "}
                <Link href={unfiltered} className="text-blue-900 underline underline-offset-2">
                  Show everything
                </Link>
              </>
            ) : (
              "Nothing due here today."
            )}
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
          <TaskBoard board={toBoard(view)} onMove={moveTask} moreHref={href({ list: true })} />
        )}
      </div>
    </>
  );
}
