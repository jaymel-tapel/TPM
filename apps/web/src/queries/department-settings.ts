import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { department, type Department } from "@/db/schema";
import { APP_TIMEZONE } from "@/lib/date";
import { DAY_END_HOUR, DAY_START_HOUR } from "@/lib/plan";

/**
 * The department's defaults, read once per request.
 *
 * Falls back to the environment variable if the row is somehow missing —
 * during a migration, say. A missing settings row should degrade to the old
 * behaviour rather than take every screen down with it.
 */
export const getDepartmentSettings = cache(async (): Promise<Department> => {
  const row = await db.query.department.findFirst({ where: eq(department.id, 1) });
  return (
    row ?? {
      id: 1,
      timezone: APP_TIMEZONE,
      workStartHour: DAY_START_HOUR,
      workEndHour: DAY_END_HOUR,
      updatedAt: new Date(),
    }
  );
});
