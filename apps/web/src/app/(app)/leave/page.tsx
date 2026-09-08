import {
  LeaveRequestList,
  LeaveRequestRow,
  PageHeader,
  SectionHeader,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { now } from "@/lib/date";
import { listMyLeave, listPendingFor } from "@/queries/leave";
import { toLeaveRequest } from "@/lib/present";
import { LeaveForm } from "@/components/leave-form";
import { CancelLeaveButton, LeaveDecision } from "@/components/leave-buttons";

export const dynamic = "force-dynamic";

/**
 * Your own leave, and anything waiting on you.
 *
 * Open to everybody, including the Senior Director — who files no request to
 * anyone but still has a queue, because an Account Director's leave is theirs
 * to decide. There is no page for one request: a request is a few dates and a
 * sentence, and a screen showing only that would be a screen with nothing on
 * it. The decisions are posted from these rows.
 */
export default async function LeavePage() {
  const { user, zone } = await requireSession();
  const reference = now(zone);

  const [mine, pending] = await Promise.all([
    listMyLeave(user),
    listPendingFor(user),
  ]);

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle="File for time off, and see where it stands."
      />

      <div className="space-y-10">
        {pending.length > 0 ? (
          <section>
            <SectionHeader
              aside={`${pending.length} awaiting you`}
            >
              Waiting on you
            </SectionHeader>
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

        <section>
          <SectionHeader>Your leave</SectionHeader>
          <LeaveRequestList empty="You have not filed for any leave.">
            {mine.map((row) => {
              const request = toLeaveRequest(row, user, reference, zone);
              return (
                <LeaveRequestRow
                  key={row.id}
                  request={request}
                  showPerson={false}
                  actions={request.cancellable ? <CancelLeaveButton id={request.id} /> : null}
                />
              );
            })}
          </LeaveRequestList>
        </section>

        <section>
          <SectionHeader>File for leave</SectionHeader>
          <LeaveForm />
        </section>
      </div>
    </>
  );
}
