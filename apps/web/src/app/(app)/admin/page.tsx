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
import { listAdminAccounts, listPeople } from "@/queries/admin";
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

  const [people, accounts, dept] = await Promise.all([
    listPeople(),
    listAdminAccounts(),
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
            <Command icon={Plus} href="/admin/accounts/new">
              Add an account
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

      <SectionHeader aside={`${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}>
        Accounts
      </SectionHeader>
      <Panel className="mb-10">
        <ul className="divide-y divide-gray-300">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-4 px-4 py-3">
              <Link
                href={`/admin/accounts/${account.id}`}
                className="min-w-0 flex-1 truncate text-body-strong text-gray-1000 hover:text-blue-800"
              >
                {account.name}
              </Link>
              <span className="text-caption text-gray-700">
                {account.accountDirectorName ?? "No director"}
              </span>
              <span className="tabular w-24 text-right text-caption text-gray-600">
                {account.headcount} {account.headcount === 1 ? "person" : "people"}
              </span>
              <span className="tabular w-20 text-right text-caption text-gray-600">
                {account.boardCount} {account.boardCount === 1 ? "board" : "boards"}
              </span>
            </li>
          ))}
          {accounts.length === 0 ? (
            <li className="px-4 py-6 text-body text-gray-600">No accounts yet.</li>
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
              {/* Every account, not the first one: "Volvo" beside somebody who
                  also carries MG is the old model showing through. */}
              <span className="w-40 truncate text-right text-caption text-gray-600">
                {person.accounts.length > 0
                  ? person.accounts.map((a) => a.name).join(", ")
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="mt-4 max-w-prose text-caption text-gray-600">
        Nobody is deleted here. People own work — tasks they wrote, documents they authored,
        comments they left — and removing the row would take that with them or refuse outright.
        Moving somebody off an account is how they stop being given work.
      </p>

      <div className="mt-6">
        <ButtonLink href="/accounts" variant="ghost">
          ← Back to accounts
        </ButtonLink>
      </div>
    </>
  );
}
