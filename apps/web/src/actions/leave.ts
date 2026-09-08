"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leaveHalfEnum, leaveKindEnum, leaveRequests } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertCanDecideLeave, isSenior } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { dayKey, leaveDays, rangeText } from "@/lib/leave";
import { now } from "@/lib/date";
import { overlappingLeave } from "@/queries/leave";

export type LeaveState = { error?: string } | null;

function refresh() {
  revalidatePath("/", "layout");
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const leaveInput = z.object({
  kind: z.enum(leaveKindEnum.enumValues),
  startDate: z.string().regex(DAY),
  endDate: z.string().regex(DAY),
  half: z.enum(leaveHalfEnum.enumValues).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/** How far back a sick day may be filed. */
const SICK_GRACE_DAYS = 14;

/**
 * File for leave.
 *
 * The days come from the form; the person never does. `userId` is taken from
 * the session, the same rule `planTask` states — there is no version of this
 * where one person books another's fortnight.
 */
export async function fileLeave(
  _prev: LeaveState,
  formData: FormData,
): Promise<LeaveState> {
  const user = await requireUser();
  const session = await getSession();
  const zone = session?.zone;

  const parsed = leaveInput.safeParse({
    kind: formData.get("kind"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    half: formData.get("half") || null,
    note: formData.get("note") || null,
  });
  if (!parsed.success) return { error: "Check the dates and try again." };
  const { kind, startDate, endDate, half, note } = parsed.data;

  if (endDate < startDate) return { error: "Leave cannot end before it starts." };
  if (half && startDate !== endDate) {
    return { error: "A half day is half of one day." };
  }
  if (leaveDays(startDate, endDate, half ?? null) === 0) {
    return { error: "Those are not working days." };
  }

  // "Today" is the filer's own today. Somebody booking tomorrow from Manila is
  // not filing in the past because it is still yesterday evening in London.
  const today = dayKey(now(zone), zone);

  if (startDate < today) {
    /*
     * Sick leave is the one kind that may be backdated. Nobody asks permission
     * in advance to be ill, and refusing a day already taken would only push
     * it off the system entirely, which is worse than recording it late.
     */
    if (kind !== "sick") return { error: "Leave has to start today or later." };
    const grace = dayKey(new Date(now(zone).getTime() - SICK_GRACE_DAYS * 86_400_000), zone);
    if (startDate < grace) return { error: "File sick leave within a fortnight." };
  }

  const clashes = await overlappingLeave(user, startDate, endDate);
  if (clashes.length > 0) {
    const clash = clashes[0];
    return {
      error: `You already have leave booked for ${rangeText(clash.startDate, clash.endDate)}.`,
    };
  }

  /*
   * The Senior Director has nobody above them on the chart, so their leave is
   * a statement rather than a request. Recorded as approved with no decider,
   * which is the honest row: it says nobody approved it, because nobody had
   * to.
   */
  const decided = isSenior(user);

  await db.insert(leaveRequests).values({
    userId: user.id,
    kind,
    startDate,
    endDate,
    half: half ?? null,
    note: note ?? null,
    status: decided ? "approved" : "pending",
    decidedAt: decided ? new Date() : null,
  });

  refresh();
  redirect("/leave");
}

const idInput = z.object({ requestId: z.string().uuid() });

/**
 * Withdraw your own request.
 *
 * Allowed while it is still pending or still to come — a cancellation only
 * ever hands time back, so an approved one does not go round the approver
 * again. Leave that has already been taken stays on the record.
 */
export async function cancelLeave(
  _prev: LeaveState,
  formData: FormData,
): Promise<LeaveState> {
  const user = await requireUser();
  const session = await getSession();
  const today = dayKey(now(session?.zone), session?.zone);

  const parsed = idInput.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) return { error: "That request could not be cancelled." };

  // The owner is part of the `where`, not something read from the form.
  const updated = await db
    .update(leaveRequests)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(leaveRequests.id, parsed.data.requestId),
        eq(leaveRequests.userId, user.id),
        inArray(leaveRequests.status, ["pending", "approved"]),
      ),
    )
    .returning({ id: leaveRequests.id, endDate: leaveRequests.endDate });

  if (updated.length === 0) return { error: "That request could not be cancelled." };
  if (updated[0].endDate < today) {
    return { error: "That leave has already been taken." };
  }

  refresh();
  return null;
}

const decisionInput = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "declined"]),
  decisionNote: z.string().trim().max(500).nullable().optional(),
});

/**
 * Approve or decline somebody's request.
 *
 * Only ever from `pending`, so a stale page or a double submit cannot overturn
 * a decision that has already been made — the status is part of the `where`
 * rather than something read first and trusted second.
 */
export async function decideLeave(
  _prev: LeaveState,
  formData: FormData,
): Promise<LeaveState> {
  const viewer = await requireUser();

  const parsed = decisionInput.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    decisionNote: formData.get("decisionNote") || null,
  });
  if (!parsed.success) return { error: "That decision could not be recorded." };

  await assertCanDecideLeave(viewer, parsed.data.requestId);

  const updated = await db
    .update(leaveRequests)
    .set({
      status: parsed.data.decision,
      decidedBy: viewer.id,
      decidedAt: new Date(),
      decisionNote: parsed.data.decisionNote ?? null,
    })
    .where(
      and(
        eq(leaveRequests.id, parsed.data.requestId),
        eq(leaveRequests.status, "pending"),
      ),
    )
    .returning({ id: leaveRequests.id });

  if (updated.length === 0) return { error: "That request has already been decided." };

  refresh();
  return null;
}
