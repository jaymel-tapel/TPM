import Link from "next/link";
import { notFound } from "next/navigation";
import { Progress } from "@meridian/ui/primitives/progress";
import {
  LeaveRequestList,
  LeaveRequestRow,
  PageHeader,
  Panel,
  Percent,
  SectionHeader,
  UserAvatar,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { getDepartmentToday } from "@/queries/department";
import { toLeaveRequest } from "@/lib/present";
import { listPendingFor } from "@/queries/leave";
import { LeaveDecision } from "@/components/leave-buttons";
import { fmtLongDate, now } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Every account the reader works on, side by side.
 *
 * The same screen for all three roles, showing a different number of rows. A
 * designer on two clients opens it and sees two; the Senior Director opens it
 * and sees the book. That is the point of the shape — "which of my clients
 * needs me today" is a question a team member has now, and could not ask when
 * they belonged to exactly one team.
 *
 * Nobody is refused outright except somebody on no account at all, who has
 * nothing here to read.
 */
export default async function AccountsPage() {
  const { user, zone } = await requireSession();
  const senior = isSenior(user);
  if (!senior && user.accountIds.length === 0) notFound();

  const reference = now(zone);
  const [dept, pending] = await Promise.all([
    getDepartmentToday(undefined, zone, senior ? undefined : user.accountIds),
    // Whose leave is waiting on this reader. Empty for a team member, which is
    // what makes the section disappear rather than show an empty box.
    listPendingFor(user),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={fmtLongDate(reference, zone)}
        title={senior ? "Accounts" : "Your accounts"}
        subtitle={
          senior
            ? "Every client the department works for, side by side."
            : "The clients you work on, and how each is doing today."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dept.accounts.map((account) => (
          <Link
            key={account.id}
            href={`/accounts/${account.id}`}
            className="block transition-colors hover:bg-gray-100"
          >
            <Panel className="h-full p-6">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-subtitle-1 text-gray-1000">{account.name}</p>
                <p className="tabular text-title-1 text-gray-1000">
                  <Percent value={account.percent} />
                </p>
              </div>
              <Progress value={account.percent} className="mt-4 h-1.5" />
              <div className="mt-4 flex items-center gap-2 border-t border-gray-300 pt-4">
                {account.directorName ? (
                  <UserAvatar name={account.directorName} size="sm" />
                ) : null}
                <p className="tabular text-caption text-gray-700">
                  <span className="text-gray-1000">{account.directorName ?? "No director"}</span>
                  {` · ${account.done}/${account.due} today · ${account.overdue} overdue · ${account.headcount} people`}
                </p>
              </div>
            </Panel>
          </Link>
        ))}
      </div>

      {pending.length > 0 ? (
        <section className="mt-10">
          <SectionHeader aside={`${pending.length} awaiting you`}>Leave requests</SectionHeader>
          <LeaveRequestList empty="Nothing is waiting on you.">
            {pending.map((row) => (
              <LeaveRequestRow
                key={row.id}
                request={toLeaveRequest(row, user, reference, zone)}
                actions={<LeaveDecision id={row.id} />}
              />
            ))}
          </LeaveRequestList>
        </section>
      ) : null}
    </>
  );
}
