import { format } from "date-fns";
import { PageHeader } from "@tpm/ui";
import { requireSession } from "@/lib/auth";
import { createTask } from "@/actions/tasks";
import { listAllTags } from "@/queries/tasks";
import { listTaskTypes, toTypeRef } from "@/queries/task-types";
import { listBoardOptions } from "@/queries/boards";
import { TaskForm } from "@/components/task-form";
import { now, startOfAppDay } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string | string[] }>;
}) {
  const { user } = await requireSession();
  const [{ board: asked }, tags, options, types] = await Promise.all([
    searchParams,
    listAllTags(),
    listBoardOptions(user),
    listTaskTypes(),
  ]);

  /*
   * The board you pressed New Task from.
   *
   * Without it the form fell back to the first board in the list — which is
   * the alphabetically first *client*, so starting a task inside Volvo landed
   * you on MG. The board is where a task lives, and the page you came from had
   * already answered it.
   *
   * Checked against the options rather than trusted: a board id from a client
   * this person is not on would otherwise preselect a board they cannot see,
   * and the id arrives in the URL where anybody can type one.
   */
  const wanted = Array.isArray(asked) ? asked[0] : asked;
  const from = options.boards.find((b) => b.id === wanted);
  const firstBoard = from ?? options.boards[0];

  /*
   * Arriving from a board narrows the picker to that client.
   *
   * Preselecting the right board but still offering the other client's was
   * half an answer: the account is not really a choice here, it was made by
   * where you started, and a list that spans clients on a page you reached
   * from one of them is an invitation to misfile. What is left to choose is
   * which of *this* client's boards — which is the actual question.
   *
   * A task that belongs to another client is started from that client's board.
   * Reaching `/tasks/new` cold still offers everything, because then nothing
   * has answered the question.
   */
  const boards = from
    ? options.boards.filter((b) => b.accountId === from.accountId)
    : options.boards;

  // Defaults to 5pm today — the common case is "this needs doing today".
  const defaultDue = new Date(startOfAppDay(now()).getTime() + 17 * 3_600_000);

  return (
    <>
      <PageHeader
        eyebrow="Create"
        title="New Task"
        subtitle="Title, when it's due, and who's on it. Nothing else to configure."
      />
      <TaskForm
        action={createTask}
        submitLabel="Create task"
        peopleByBoard={options.peopleByBoard}
        allTags={tags}
        taskTypes={types.map(toTypeRef)}
        boards={boards}
        statusesByBoard={options.statusesByBoard}
        values={{
          title: "",
          description: "",
          type: "client_work",
          // The board you came from, or — arriving from nowhere in particular —
          // the first one this person can write to. Either way, its first column.
          boardId: firstBoard?.id ?? "",
          statusId: firstBoard ? (options.statusesByBoard[firstBoard.id]?.[0]?.id ?? "") : "",
          estimate: "",
          actual: "",
          priority: "normal",
          dueDate: format(defaultDue, "yyyy-MM-dd'T'HH:mm"),
          // The Senior Director sits outside both accounts and so is not an
          // assignable person; they pick who the work is for.
          assignees: user.accountIds.length > 0 ? [user.id] : [],
          tags: [],
        }}
      />
    </>
  );
}
