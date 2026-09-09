import Link from "next/link";
import { Progress } from "../primitives/progress";
import { WorkBar } from "./work-bar";
import { CAMPAIGN_STATUS_LABELS, type CampaignRowData } from "../types";
import { cn } from "../lib/utils";

/**
 * A campaign's state, as a word rather than a colour.
 *
 * Grey throughout, deliberately. Planned, live and wrapped are all fine states
 * to be in — none of them reports a problem, and red and green are reserved
 * here for work that is late or done. Only "live" gets any weight, because on
 * a list of a client's campaigns that is the one you were looking for.
 */
function StatusChip({ status }: { status: CampaignRowData["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 text-caption-strong",
        status === "live" ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-800",
      )}
    >
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * One campaign: what it is, when it runs, and how much of it is done.
 *
 * Two bars, and they answer different questions. `WorkBar` is delivery — done
 * against overdue against what is left. The thin track under it is the
 * calendar: how much of the campaign's own dates have gone. A campaign 80%
 * elapsed and 40% delivered is the row worth stopping on, and neither bar says
 * that alone.
 */
export function CampaignRow({ campaign }: { campaign: CampaignRowData }) {
  const remaining = Math.max(0, campaign.total - campaign.done - campaign.overdue);

  const note =
    campaign.total === 0
      ? "No work filed against it yet"
      : [
          `${campaign.done} / ${campaign.total} tasks completed`,
          campaign.dueSoon > 0 ? `${campaign.dueSoon} due this week` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Link
      href={campaign.href}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-6 py-4 transition-colors hover:bg-gray-100 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_96px]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-body-strong text-gray-1000">{campaign.name}</span>
          <StatusChip status={campaign.status} />
        </div>
        <div className="mt-1 truncate text-caption text-gray-600">{campaign.rangeText}</div>
      </div>

      <div className="col-span-2 min-w-0 lg:col-span-1">
        <WorkBar done={campaign.done} remaining={remaining} overdue={campaign.overdue} />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 text-caption text-gray-600">
          <span className="tabular">{note}</span>
          {campaign.overdue > 0 ? (
            <span className="tabular text-red-700">{campaign.overdue} overdue</span>
          ) : null}
          {campaign.blocked > 0 ? (
            <span className="tabular text-red-700">{campaign.blocked} blocked</span>
          ) : null}
        </div>
      </div>

      <div className="justify-self-end text-right">
        {/* A dash, not 0%. Nothing has been filed against it, which is not the
            same as none of it being done. */}
        <div className="tabular text-subtitle-1 text-gray-1000">
          {campaign.total === 0 ? "—" : `${campaign.percent}%`}
        </div>
        {/* The calendar, not the work. Quiet on purpose — it is context for the
            number above it rather than a second headline. */}
        <Progress value={campaign.elapsed} className="mt-2 h-1 w-16" />
        <div className="mt-1 text-caption text-gray-600">{campaign.elapsedText}</div>
      </div>
    </Link>
  );
}

export function CampaignList({
  children,
  empty = "No campaigns yet.",
}: {
  children?: React.ReactNode;
  empty?: string;
}) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) ? rows.length === 0 : !rows;

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-gray-400 bg-background-100 px-6 py-8 text-center text-body text-gray-600">
        {empty}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-lg border border-gray-400 bg-background-100">
      {rows}
    </div>
  );
}
