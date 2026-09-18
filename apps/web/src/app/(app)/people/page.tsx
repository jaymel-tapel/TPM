import { MemberList, MemberRow, PageHeader, SectionHeader } from "@tpm/ui";
import { requireSession } from "@/lib/auth";
import { isDirector } from "@/lib/permissions";
import { listPeople } from "@/queries/people";
import { toPersonRow } from "@/lib/present";
import { now } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Who is doing what, across the agency.
 *
 * The one screen read by person rather than by client. Somebody on two
 * accounts appears once, with both named under them — the opposite of an
 * account's Team page, where the same person appears on each account they work
 * on. Both are true; they answer different questions.
 *
 * Their numbers are their whole day's, not one client's share of it, because
 * that is how the day is actually experienced.
 */
export default async function PeoplePage() {
  const { user, zone } = await requireSession();
  const reference = now(zone);
  const people = await listPeople(user, reference, zone);

  // Opening somebody's day is `assertCanViewUser`'s call, and it refuses a team
  // member anybody but themselves. Rows that would 404 are not links.
  const canOpen = isDirector(user);

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Everyone you share a client with, and what they are carrying today."
      />

      <SectionHeader aside={`${people.length} people`}>Today</SectionHeader>
      <MemberList>
        {people.map((person) => (
          <MemberRow
            key={person.id}
            member={toPersonRow(
              person,
              canOpen || person.id === user.id ? "/people" : null,
              reference,
              zone,
            )}
          />
        ))}
      </MemberList>
    </>
  );
}
