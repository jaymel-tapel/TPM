import { Columns3, Flag, List, Megaphone, Plus, Settings2, Shapes, Tag, User } from "lucide-react";
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
  TASK_TYPE_LABELS,
  TASK_TYPES_ORDER,
  TaskBoard,
  TaskList,
  TaskRow,
  TypeLabel,
  type FilterOption,
  type Priority,
} from "@meridian/ui";
import { notFound } from "next/navigation";
import { openAccount } from "@/lib/account-page";
import { canViewAccount } from "@/lib/permissions";
import { getBoardView, listBoardTags, listBoardsForAccounts } from "@/queries/tasks";
import { listCampaignOptions } from "@/queries/campaigns";
import { listAccountMembers } from "@/queries/accounts";
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
  campaign?: string;
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
    campaign: one(query.campaign),
    type: one(query.type),
    priority: one(query.priority),
    tag: one(query.tag),
  };
  const asList = current.list;
  const narrowed = Boolean(
    current.person || current.campaign || current.type || current.priority || current.tag,
  );

  /*
   * The board has to belong to *this* account. It arrives in the path, so a
   * board id from another client would otherwise render that client's work
   * under this one's name — past a guard that only checked the account.
   */
  const boards = await listBoardsForAccounts([accountId]);
  const board = boards.find((b) => b.id === boardId);
  if (!board) notFound();

  const [view, campaigns, people, boardTags] = await Promise.all([
    getBoardView(
      board.id,
      undefined,
      {
        assigneeId: current.person ?? null,
        campaignId: current.campaign ?? null,
        // Straight off the URL and into `workFilterSql`, which drops anything
        // that is not a value rather than pasting it into SQL.
        type: current.type,
        priority: current.priority,
        tag: current.tag,
      },
      zone,
    ),
    listCampaignOptions(accountId),
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
    if (next.campaign) params.set("campaign", next.campaign);
    if (next.type) params.set("type", next.type);
    if (next.priority) params.set("priority", next.priority);
    if (next.tag) params.set("tag", next.tag);
    const search = params.toString();
    return `/accounts/${accountId}/tasks/${boardId}${search ? `?${search}` : ""}`;
  };

  /** Back to the whole board, keeping only which of the two views you are on. */
  const unfiltered = href({
    person: undefined,
    campaign: undefined,
    type: undefined,
    priority: undefined,
    tag: undefined,
  });

  const mine = current.person === user.id;

  const personOptions: FilterOption[] = people.map((p) => ({
    value: p.id,
    label: p.id === user.id ? "Just me" : p.name,
    short: p.id === user.id ? "Just me" : p.name,
    href: href({ person: p.id }),
  }));

  const campaignOptions: FilterOption[] = campaigns.map((c) => ({
    value: c.id,
    label: c.name,
    short: c.name,
    href: href({ campaign: c.id }),
  }));

  const typeOptions: FilterOption[] = TASK_TYPES_ORDER.map((type) => ({
    value: type,
    label: <TypeLabel type={type} />,
    short: TASK_TYPE_LABELS[type],
    href: href({ type }),
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

      <CommandBar className="mb-4">
        <Command icon={List} href={href({ list: true })} active={asList}>
          List
        </Command>
        <Command icon={Columns3} href={href({ list: false })} active={!asList}>
          Board
        </Command>
        <CommandDivider />
        {/*
          A filter, not a third view — it narrows whichever view is showing.
          It writes the same `person` the menu below does rather than a
          parameter of its own: two ways to say "Anna's work" is two ways for
          them to disagree.
        */}
        <Command icon={User} href={href({ person: mine ? undefined : user.id })} active={mine}>
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

      {/*
        Its own row, because five of these would push the verbs off the end of
        the bar above. They narrow rather than switch, and every option is a
        link — a board narrowed to one client's launch is a URL you can send.
      */}
      <div className="mb-6 flex flex-wrap items-center gap-1">
        <FilterMenu
          label="Assignee"
          icon={User}
          options={personOptions}
          value={current.person}
          clearHref={href({ person: undefined })}
          empty="Nobody is on this account yet"
        />
        <FilterMenu
          label="Campaign"
          icon={Megaphone}
          options={campaignOptions}
          value={current.campaign}
          clearHref={href({ campaign: undefined })}
          empty="This account has no campaigns"
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
      </div>

      <div className="mt-6">
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
