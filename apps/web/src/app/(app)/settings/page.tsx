import Link from "next/link";
import { PageHeader, Panel } from "@tpm/ui";
import { requireSession } from "@/lib/auth";
import { fmt, now } from "@/lib/date";
import { getDepartmentSettings } from "@/queries/department-settings";
import { supportedZones } from "@/lib/zones";
import { DaySettingsForm } from "@/components/day-settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, zone, hours } = await requireSession();
  const dept = await getDepartmentSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Your day"
        subtitle="Where your day begins and ends, and the hours the plan opens on."
      />

      <Panel className="p-6">
        <DaySettingsForm
          zones={supportedZones()}
          timezone={user.timezone ?? ""}
          departmentZone={dept.timezone}
          startHour={hours.startHour}
          endHour={hours.endHour}
          defaultStartHour={dept.workStartHour}
          defaultEndHour={dept.workEndHour}
        />
      </Panel>

      <p className="text-caption text-gray-700">
        It is {fmt(now(zone), "h:mm a")} for you right now. Your timezone decides
        which tasks count as due today, what reads as overdue, and whether work
        was finished on time — so a colleague in another zone can see the same
        task differently, and you will both be right.{" "}
        <Link href="/today" className="text-blue-700 underline-offset-2 hover:underline">
          Back to today
        </Link>
      </p>
    </div>
  );
}
