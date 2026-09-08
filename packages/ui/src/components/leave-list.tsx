import { cn } from "../lib/utils";
import { UserAvatar } from "./user-avatar";
import {
  LEAVE_KIND_LABELS,
  LEAVE_STATUS_LABELS,
  type LeaveRequestData,
  type LeaveStatus,
} from "../types";

/*
 * Red and green report state here, never decoration — DESIGN.md's rule. A
 * decline is the one outcome somebody has to act on, so it is the only one
 * that gets a warm colour; approved is quiet because approved is the ordinary
 * answer, and pending is grey because it is a state rather than a warning.
 */
const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-gray-200 text-gray-800",
  approved: "bg-green-100 text-green-900",
  declined: "bg-red-100 text-red-900",
  cancelled: "bg-gray-100 text-gray-600",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 text-caption-strong",
        STATUS_STYLES[status],
      )}
    >
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * One request.
 *
 * `actions` is a slot rather than a callback because there are two verbs here
 * with different shapes — approve and decline carry a note, cancel carries
 * nothing — and this package holds no verbs at all. The app drops its own
 * forms in and nothing here learns what a server action is.
 */
export function LeaveRequestRow({
  request,
  showPerson = true,
  actions,
}: {
  request: LeaveRequestData;
  /** Off on your own list, where every row is you. */
  showPerson?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3">
      {showPerson ? <UserAvatar name={request.personName} size="md" /> : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showPerson ? (
            <span className="text-body-strong text-gray-1000">{request.personName}</span>
          ) : null}
          <span
            className={cn(
              "text-gray-1000",
              showPerson ? "text-body" : "text-body-strong",
            )}
          >
            {request.rangeText}
          </span>
          <LeaveStatusBadge status={request.status} />
        </div>

        <div className="mt-0.5 text-caption text-gray-600">
          {LEAVE_KIND_LABELS[request.kind]}
          {` · ${request.lengthText}`}
          {request.decisionText ? ` · ${request.decisionText}` : ""}
        </div>

        {request.note ? (
          <p className="mt-1 text-caption text-gray-700">{request.note}</p>
        ) : null}
      </div>

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function LeaveRequestList({
  children,
  empty,
}: {
  /** Optional, because an empty queue is the ordinary case and the good one. */
  children?: React.ReactNode;
  /** What to say when there is nothing. */
  empty: string;
}) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-gray-400 px-4 py-8 text-center text-body text-gray-600">
        {empty}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
      {children}
    </div>
  );
}
