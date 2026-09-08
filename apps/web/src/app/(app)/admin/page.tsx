import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import {
  ButtonLink,
  Command,
  CommandBar,
  CommandDivider,
  PageHeader,
  Panel,
  SectionHeader,
  UserAvatar,
} from "@meridian/ui";
import { ROLE_LABELS } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { listAdminTeams, listPeople } from "@/queries/admin";
import { getDepartmentSettings } from "@/queries/department-settings";
import { supportedZones } from "@/lib/zones";
import { DepartmentForm } from "@/components/department-form";

export const dynamic = "force-dynamic";

/**
 * The org chart, which everything else is derived from: which board a task can
 * be filed on, who may be assigned to it, who may be named in a description.
 * It is the one screen that writes what the rest of the product only reads.
 */
export default async function AdminPage() {
  const { user } = await requireSession();
  await assertCanAdminister(user);

  const [people, teams, dept] = await Promise.all([
    listPeople(),
    listAdminTeams(),
    getDepartmentSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="The org chart. Everything else in the product is read from it."
        commands={
          <CommandBar>
            <Command icon={UserPlus} href="/admin/people/new">
              Add a person
            </Command>
            <CommandDivider />
            <Command icon={Plus} href="/admin/teams/new">
              Add a team
            </Command>
          </CommandBar>
        }
      />

      <SectionHeader>Department</SectionHeader>
      <Panel className="mb-10 p-6">
        <DepartmentForm
          zones={supportedZones()}
          timezone={dept.timezone}
          startHour={dept.workStartHour}
          endHour={dept.workEndHour}
        />
      </Panel>

      <SectionHeader aside={`${teams.length} ${teams.length === 1 ? "team" : "teams"}`}>
        Teams
      </SectionHeader>
      <Panel className="mb-10">
        <ul className="divide-y divide-gray-300">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center gap-4 px-4 py-3">
              <Link
                href={`/admin/teams/${team.id}`}
                className="min-w-0 flex-1 truncate text-body-strong text-gray-1000 hover:text-blue-800"
              >
                {team.name}
              </Link>
              <span className="text-caption text-gray-700">
                {team.accountDirectorName ?? "No director"}
              </span>
              <span className="tabular w-24 text-right text-caption text-gray-600">
                {team.headcount} {team.headcount === 1 ? "person" : "people"}
              </span>
              <span className="tabular w-20 text-right text-caption text-gray-600">
                {team.boardCount} {team.boardCount === 1 ? "board" : "boards"}
              </span>
            </li>
          ))}
          {teams.length === 0 ? (
            <li className="px-4 py-6 text-body text-gray-600">No teams yet.</li>
          ) : null}
        </ul>
      </Panel>

      <SectionHeader aside={`${people.length} ${people.length === 1 ? "person" : "people"}`}>
        People
      </SectionHeader>
      <Panel>
        <ul className="divide-y divide-gray-300">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar name={person.name} size="sm" />
              <Link
                href={`/admin/people/${person.id}`}
                className="min-w-0 flex-1 truncate text-body-strong text-gray-1000 hover:text-blue-800"
              >
                {person.name}
              </Link>
              <span className="hidden min-w-0 flex-1 truncate text-caption text-gray-600 sm:block">
                {person.email}
              </span>
              <span className="w-36 text-right text-caption text-gray-700">
                {ROLE_LABELS[person.role]}
              </span>
              <span className="w-24 text-right text-caption text-gray-600">
                {person.teamName ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="mt-4 max-w-prose text-caption text-gray-600">
        Nobody is deleted here. People own work — tasks they wrote, documents they authored,
        comments they left — and removing the row would take that with them or refuse outright.
        Moving somebody off a team is how they stop being given work.
      </p>

      <div className="mt-6">
        <ButtonLink href="/overview" variant="ghost">
          ← Back to overview
        </ButtonLink>
      </div>
    </>
  );
}
