"use client";

import { DayPlan, type PlanBlockData } from "@meridian/ui";
import { planTask, unplanTask } from "@/actions/schedule";

/**
 * Binds the day plan to its server actions, the way `task-activity.tsx` does.
 * Nothing else: the grid lays itself out, and the hour labels arrive as data
 * so the gallery can render the same component with no actions at all.
 */
export function DayPlanPanel({
  blocks,
  startHour,
  endHour,
  nowMinutes,
  dayStartIso,
  hourLabels,
}: {
  blocks: PlanBlockData[];
  startHour: number;
  endHour: number;
  nowMinutes: number | null;
  dayStartIso: string;
  /** Minutes-from-midnight → "9 AM", formatted server-side. */
  hourLabels: Record<number, string>;
}) {
  return (
    <DayPlan
      blocks={blocks}
      startHour={startHour}
      endHour={endHour}
      nowMinutes={nowMinutes}
      dayStartIso={dayStartIso}
      hourLabels={hourLabels}
      onPlan={async (data) => {
        await planTask(data);
      }}
      onUnplan={unplanTask}
    />
  );
}
