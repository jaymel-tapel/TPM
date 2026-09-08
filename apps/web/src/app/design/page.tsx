import { Alert, AlertDescription, AlertTitle } from "@meridian/ui/primitives/alert";
import { Badge } from "@meridian/ui/primitives/badge";
import { Button } from "@meridian/ui/primitives/button";
import { Checkbox } from "@meridian/ui/primitives/checkbox";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { Progress } from "@meridian/ui/primitives/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@meridian/ui/primitives/select";
import { Separator } from "@meridian/ui/primitives/separator";
import { Skeleton } from "@meridian/ui/primitives/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@meridian/ui/primitives/table";
import { Tabs, TabsList, TabsTrigger } from "@meridian/ui/primitives/tabs";
import { Textarea } from "@meridian/ui/primitives/textarea";
import { RichTextEditor, RichTextView } from "@meridian/ui/editor";
import { Columns3, List, Plus, Trash2 } from "lucide-react";
import {
  AvatarStack,
  CompletionMeter,
  DeltaBadge,
  EmptyState,
  Eyebrow,
  HeroPanel,
  HighlightMetric,
  MemberList,
  MemberListSkeleton,
  MemberRow,
  NeedsAttention,
  PageHeader,
  Panel,
  Percent,
  PriorityBadge,
  PriorityLabel,
  SectionHeader,
  Stat,
  StatBandSkeleton,
  StatusBadge,
  AttachmentList,
  Command,
  CommandBar,
  CommandDivider,
  TaskBoard,
  TaskListSkeleton,
  TeamCompare,
  TASK_TYPES_ORDER,
  TASK_TYPE_LABELS,
  TagBadge,
  TaskList,
  TaskRow,
  TypeLabel,
  UserAvatar,
  type TaskType,
  TrendStrip,
} from "@meridian/ui";
import { TrendChart } from "@meridian/ui/chart";
import { ErrorStateDemo } from "./error-demo";
import { ATTACHMENTS, ATTENTION, BOARD, MEMBERS, TASKS, TEAMS, TREND } from "./fixtures";

export const metadata = { title: "Meridian — Design System" };

/* ── gallery scaffolding ──────────────────────────────────────────────── */

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader aside={note}>{title}</SectionHeader>
      <Panel className="p-6">{children}</Panel>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-gray-300 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-6">
      <div className="text-caption text-gray-600">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** One scale, all ten steps, with the role each step plays. */
const STEP_ROLES = [
  "subtle bg",
  "subtle bg hover",
  "muted bg",
  "border",
  "border hover",
  "placeholder",
  "solid / secondary text",
  "solid hover",
  "primary text",
  "high contrast",
];

function Scale({ name, prefix }: { name: string; prefix: string }) {
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  return (
    <div>
      <div className="mb-2 text-body-strong text-gray-1000">{name}</div>
      <div className="flex overflow-hidden rounded-lg border border-gray-400">
        {steps.map((s) => (
          // Referenced through the CSS variable rather than a built class name,
          // so Tailwind never has to guess at a dynamic string.
          <div
            key={s}
            className="h-12 flex-1"
            style={{ background: `var(--color-${prefix}-${s})` }}
          />
        ))}
      </div>
      <div className="mt-1 flex">
        {steps.map((s) => (
          <div key={s} className="flex-1 text-center text-caption-strong text-gray-600">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-gray-400 bg-background-100">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-6">
          <span className="grid size-6 place-items-center rounded-md bg-blue-700 text-caption-strong text-white">
            M
          </span>
          <span className="text-body-strong text-gray-1000">Meridian</span>
          <Badge variant="secondary">Design system</Badge>
          <span className="ml-auto text-caption text-gray-600">
            Following Fluent 2 · see DESIGN.md
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
        <PageHeader
          eyebrow="Foundations & components"
          title="The system before the screens"
          subtitle={
            <>
              This product follows <strong className="text-gray-1000">Fluent 2</strong>,
              Microsoft&rsquo;s design system — the one Azure DevOps is built on. Compact type
              with no decorative tracking, a true-grey neutral ramp, square-ish radii and rows
              dense enough that a fifteen-person team fits on one screen. The client&rsquo;s
              brand replaces Fluent&rsquo;s communication blue; the neutrals are Fluent&rsquo;s
              own. Every value on this page cites a token — no arbitrary sizes, no one-off hex
              codes.
            </>
          }
        />

        {/* ── Colour ───────────────────────────────────────────────── */}

        <Block title="Colour" note="Ten steps. One job per step.">
          <div className="mb-6 grid gap-x-6 gap-y-1 text-caption text-gray-700 sm:grid-cols-2 lg:grid-cols-5">
            {STEP_ROLES.map((role, i) => (
              <div key={role} className="flex gap-2">
                <span className="tabular w-9 shrink-0 text-gray-500">{(i + 1) * 100}</span>
                <span>{role}</span>
              </div>
            ))}
          </div>
          <Separator className="mb-6" />
          <div className="space-y-5">
            <Scale name="Gray" prefix="gray" />
            <Scale name="Blue — brand, identity and actions" prefix="blue" />
            <Scale name="Amber — one number per screen" prefix="amber" />
            <Scale name="Red — state, never decoration" prefix="red" />
            <Scale name="Green — state, never decoration" prefix="green" />
          </div>
          <Separator className="my-6" />
          <Row label="Surfaces">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-md border border-gray-400 bg-background-100" />
              <span className="text-caption text-gray-700">background-100 · working surface</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-md border border-gray-400 bg-background-200" />
              <span className="text-caption text-gray-700">background-200 · app shell</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-md bg-navy" />
              <span className="text-caption text-gray-700">navy · leadership hero only</span>
            </div>
          </Row>
        </Block>

        {/* ── Type ─────────────────────────────────────────────────── */}

        <Block title="Type" note="Fluent ramp. Zero tracking at every size; headings semibold, not bold.">
          <div className="space-y-4">
            {[
              ["display", "text-display", "78%"],
              ["large-title", "text-large-title", "Team A"],
              ["title-1", "text-title-1", "Good morning, Anna"],
              ["title-3", "text-title-3", "Department Today"],
              ["subtitle-1", "text-subtitle-1", "Team Members"],
              ["subtitle-2", "text-subtitle-2", "Send client performance report"],
              ["body-strong", "text-body-strong", "Review campaign launch assets"],
              ["body-lg", "text-body-lg", "The system should answer questions directly."],
              ["body", "text-body", "Client Work · Nike · Today, 2:00 PM"],
              ["caption", "text-caption", "3 of 5 tasks completed today"],
              ["caption-strong", "text-caption-strong uppercase tracking-[0.08em]", "Today"],
            ].map(([name, cls, sample]) => (
              <div
                key={name}
                className="grid items-baseline gap-2 border-b border-gray-300 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-6"
              >
                <code className="text-caption text-gray-600">{name}</code>
                <div className={`${cls} text-gray-1000`}>{sample}</div>
              </div>
            ))}
          </div>
        </Block>

        {/* ── Space, radius, elevation ─────────────────────────────── */}

        <Block title="Space, radius & elevation" note="4pt grid. Border first; Fluent shadows for what floats.">
          <Row label="Space">
            {[
              ["1", "4", "w-1"],
              ["2", "8", "w-2"],
              ["3", "12", "w-3"],
              ["4", "16", "w-4"],
              ["6", "24", "w-6"],
              ["8", "32", "w-8"],
              ["12", "48", "w-12"],
              ["16", "64", "w-16"],
            ].map(([step, px, cls]) => (
              <div key={step} className="text-center">
                <div className={`${cls} h-8 rounded-md bg-blue-300`} />
                <div className="mt-1 text-caption-strong text-gray-600">{px}</div>
              </div>
            ))}
          </Row>
          <Row label="Radius">
            {[
              ["radius-sm", "rounded-sm", "chips, marks"],
              ["radius-md", "rounded-md", "inputs, buttons, commands"],
              ["radius-lg", "rounded-lg", "rows, cards"],
              ["radius-xl", "rounded-xl", "panels, dialogs"],
            ].map(([name, cls, use]) => (
              <div key={name} className="w-32">
                <div className={`h-12 border border-gray-400 bg-gray-100 ${cls}`} />
                <div className="mt-1 text-caption-strong text-gray-1000">{name}</div>
                <div className="text-caption text-gray-600">{use}</div>
              </div>
            ))}
          </Row>
          <Row label="Elevation">
            {[
              ["flat", "border border-gray-400", "cards, lists"],
              ["shadow-small", "border border-gray-400 shadow-small", "hover"],
              ["shadow-medium", "shadow-medium", "popovers"],
              ["shadow-large", "shadow-large", "dialogs"],
            ].map(([name, cls, use]) => (
              <div key={name} className="w-32">
                <div className={`h-12 rounded-xl bg-background-100 ${cls}`} />
                <div className="mt-1 text-caption-strong text-gray-1000">{name}</div>
                <div className="text-caption text-gray-600">{use}</div>
              </div>
            ))}
          </Row>
        </Block>

        {/* ── Controls ─────────────────────────────────────────────── */}

        <Block title="Controls" note="shadcn/ui primitives, themed by the tokens above">
          <Row label="Button">
            <Button>New Task</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Text action</Button>
          </Row>
          <Row label="Sizes / states">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row label="Badge">
            <Badge>Default</Badge>
            <Badge variant="secondary">Collaborative</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Overdue</Badge>
            <TagBadge>Nike</TagBadge>
          </Row>
          <Row label="Input">
            <Input placeholder="What needs to happen?" className="max-w-xs" />
          </Row>
          <Row label="Select">
            <Select defaultValue="client_work">
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    <TypeLabel type={t} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Textarea">
            <Textarea placeholder="Optional context" className="max-w-xs" rows={3} />
          </Row>
          <Row label="Checkbox">
            <div className="flex items-center gap-2">
              <Checkbox id="a" defaultChecked />
              <Label htmlFor="a">Anna Santos</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="b" />
              <Label htmlFor="b">James Cruz</Label>
            </div>
          </Row>
          <Row label="Tabs">
            <Tabs defaultValue="today">
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">Next 7 days</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
              </TabsList>
            </Tabs>
          </Row>
          <Row label="Progress">
            <div className="w-64 space-y-2">
              <Progress value={83} className="h-1.5" />
              <Progress value={43} className="h-1.5" />
              <Progress value={100} className="h-1.5" />
            </div>
          </Row>
          <Row label="Skeleton">
            <div className="w-64 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </Row>
          <Row label="Alert">
            <Alert className="max-w-md">
              <AlertTitle>Shared task</AlertTitle>
              <AlertDescription>
                Completing it marks it done for everyone assigned.
              </AlertDescription>
            </Alert>
          </Row>
        </Block>

        {/* ── Domain ───────────────────────────────────────────────── */}

        <Block title="People" note="Filled disc, coloured deterministically from the name">
          <Row label="Sizes">
            <UserAvatar name="Anna Santos" size="xs" />
            <UserAvatar name="Anna Santos" size="sm" />
            <UserAvatar name="Anna Santos" size="md" />
            <UserAvatar name="Anna Santos" size="lg" />
            <UserAvatar name="Anna Santos" size="xl" />
          </Row>
          <Row label="Distinct people">
            {["Anna Santos", "James Cruz", "Sofia Reyes", "Marco Ilagan", "Bea Fernandez", "Elena Rivera"].map(
              (n) => (
                <UserAvatar key={n} name={n} size="lg" />
              ),
            )}
          </Row>
          <Row label="Collaborators">
            <AvatarStack names={["Anna Santos", "James Cruz"]} />
            <AvatarStack names={["Anna Santos", "James Cruz", "Sofia Reyes"]} />
            <AvatarStack
              names={["Anna Santos", "James Cruz", "Sofia Reyes", "Marco Ilagan", "Bea Fernandez"]}
            />
          </Row>
        </Block>

        <Block title="Task vocabulary" note="State reads without colour">
          <Row label="Status">
            {/*
              Columns are named by whoever made the board; the mark comes from
              the kind. "Shipped" and "Done" are the same thing to every query
              in the system, and look it.
            */}
            <StatusBadge status={{ id: "c1", name: "To Do", kind: "open" }} />
            <StatusBadge status={{ id: "c2", name: "In Review", kind: "open" }} />
            <StatusBadge status={{ id: "c3", name: "Shipped", kind: "done" }} />
            <StatusBadge status={{ id: "c4", name: "Blocked", kind: "blocked" }} />
          </Row>
          <Row label="Task type">
            {TASK_TYPES_ORDER.map((t) => (
              <TypeLabel key={t} type={t} className="text-caption text-gray-700" />
            ))}
          </Row>
          <Row label="Priority">
            <PriorityLabel priority="high" />
            <PriorityLabel priority="urgent" />
            <PriorityBadge priority="high" />
            <PriorityBadge priority="urgent" />
            <span className="text-caption text-gray-500">Normal priority is never shown</span>
          </Row>
        </Block>

        <Block title="Task list" note="Every state the list can be in">
          <div className="space-y-6">
            <TaskList title="Today">
              <TaskRow task={TASKS.plain} viewer="u-anna" />
              <TaskRow task={TASKS.inProgress} viewer="u-anna" />
              <TaskRow task={TASKS.highPriority} viewer="u-anna" />
              <TaskRow task={TASKS.blocked} viewer="u-anna" />
            </TaskList>

            <TaskList title="Carried over" tone="danger">
              <TaskRow task={TASKS.overdue} viewer="u-anna" />
            </TaskList>

            <TaskList title="Completed" tone="quiet">
              <TaskRow task={TASKS.done} viewer="u-anna" quiet />
            </TaskList>

            <div>
              <Eyebrow rule className="mb-3">
                Empty
              </Eyebrow>
              <EmptyState>Everything due today is done.</EmptyState>
            </div>
          </div>
        </Block>

        <Block title="Description" note="Rich text, and the files that come with it">
          <p className="mb-6 max-w-prose text-caption text-gray-700">
            BlockNote wearing this system&rsquo;s tokens rather than its own skin. Dropping a
            file into the prose uploads it and records it as an attachment, so there is one
            list of everything on a task instead of two. The column stores the document as
            JSON; a description written before the editor existed still opens as prose.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-caption-strong uppercase tracking-[0.08em] text-gray-600">
                Editing
              </p>
              <RichTextEditor name="design-description" defaultValue="Client moved the launch up. Deck needs a rebuild before Friday." />
            </div>
            <div>
              <p className="mb-2 text-caption-strong uppercase tracking-[0.08em] text-gray-600">
                Reading
              </p>
              <RichTextView value="Client moved the launch up. Deck needs a rebuild before Friday." />
            </div>
          </div>

          <div className="mt-6 max-w-xl">
            <AttachmentList attachments={ATTACHMENTS} />
          </div>
        </Block>

        <Block title="Command bar" note="Page verbs, in the same place on every screen">
          <p className="mb-6 max-w-prose text-body text-gray-700">
            Icon plus word, divided into groups. The icon makes the row scannable and the
            word makes it unambiguous — a bar of glyphs alone is a guessing game. A page has
            exactly one primary button and it is never in here.
          </p>
          <CommandBar>
            <Command icon={Plus} href="#" tone="primary">
              New Task
            </Command>
            <CommandDivider />
            <Command icon={List} href="#">
              List
            </Command>
            <Command icon={Columns3} href="#" active>
              Board
            </Command>
            <CommandDivider />
            <Command icon={Trash2} href="#" tone="danger">
              Delete
            </Command>
          </CommandBar>
        </Block>

        <Block title="Board" note="A lens on the day, not a place work lives">
          <p className="mb-6 max-w-prose text-caption text-gray-700">
            Columns are the four fixed statuses — there is no column builder, and none is
            coming. The list stays the default view; the brief rules out Kanban as the
            default interface. Dragging is an enhancement: every card is a link to the task,
            where status can be changed with a keyboard.
          </p>
          <TaskBoard board={BOARD} />

        </Block>

        <Block title="Metrics">
          <Row label="Sizes">
            <Stat value="30" label="People" size="sm" />
            <Stat value="87" label="Tasks due" size="md" />
            <Stat value={<Percent value={81} />} label="Completion today" size="lg" />
          </Row>
          <Row label="Tones">
            <Stat value="12" label="Overdue" size="md" tone="danger" />
            <Stat value="68" label="Completed" size="md" />
          </Row>
          <Row label="Completion meter">
            <Panel className="w-64 p-6">
              <CompletionMeter done={3} due={5} percent={60} />
            </Panel>
          </Row>
        </Block>

        <Block title="Team roster" note="The whole row is the click target">
          <MemberList>
            {MEMBERS.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </MemberList>
        </Block>

        <Block title="Change" note="Zero is not an improvement">
          <Row label="Delta badge">
            <DeltaBadge value={6} />
            <DeltaBadge value={-12} />
            <DeltaBadge value={0} />
          </Row>
          <Row label="On navy">
            <span className="flex gap-3 rounded-xl bg-navy p-4">
              <DeltaBadge value={6} tone="dark" />
              <DeltaBadge value={-12} tone="dark" />
              <DeltaBadge value={0} tone="dark" />
            </span>
          </Row>
        </Block>

        <Block
          title="Trend strip"
          note="Zoomed to the data, and says so"
        >
          <p className="mb-6 max-w-prose text-caption text-gray-700">
            Completion rates cluster in a narrow band, so a 0–100 scale would draw seven
            identical bars. The strip zooms to the data and states the range it is using,
            rather than truncating silently.
          </p>
          <TrendStrip data={TREND} />
          <div className="mt-6 rounded-xl bg-navy p-6">
            <TrendStrip data={TREND} tone="dark" />
          </div>
        </Block>

        <Block title="Team comparison" note="One shared axis, not two cards">
          <TeamCompare teams={TEAMS} />
        </Block>

        <Block title="Needs attention" note="Sentences, not charts to interpret">
          <NeedsAttention items={ATTENTION} />
        </Block>

        <Block title="Leadership hero" note="Navy and amber appear here only">
          <HeroPanel>
            <Eyebrow tone="onDark">Department Today</Eyebrow>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
              <div>
                <h3 className="text-title-1 text-white">Sunday, September 6</h3>
                <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
                  <Stat value="30" label="People" size="sm" tone="onDark" />
                  <Stat value="87" label="Tasks due" size="sm" tone="onDark" />
                  <Stat value="68" label="Completed" size="sm" tone="onDark" />
                  <Stat value="11" label="Overdue" size="sm" tone="onDark" />
                </dl>
              </div>
              <HighlightMetric value={78} label="Completion rate" progress={78} />
            </div>
            <div className="mt-8">
              <NeedsAttention items={ATTENTION.slice(0, 2)} tone="dark" />
            </div>
          </HeroPanel>
        </Block>

        <Block title="Loading" note="Built from the components they stand in for">
          <p className="mb-6 max-w-prose text-caption text-gray-700">
            Each skeleton mirrors the layout of the screen it covers, so the page does not
            jump when the real content arrives. Every route has one, plus a shared error
            boundary — before this, a slow query showed a blank page and a failed one showed
            a raw Next.js error.
          </p>
          <div className="space-y-6">
            <TaskListSkeleton rows={2} />
            <MemberListSkeleton rows={3} />
            <StatBandSkeleton />
          </div>
        </Block>

        <Block title="Error state" note="Says what failed and offers the one useful action">
          <ErrorStateDemo />
        </Block>

        <Block title="Chart" note="One series. The only chart in the product.">
          <TrendChart data={TREND} />
        </Block>

        <Block title="Table" note="Used only in reports">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MEMBERS.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-body-strong">
                      <UserAvatar name={m.name} size="sm" />
                      {m.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-700">Team A</TableCell>
                  <TableCell className="tabular text-right text-gray-700">
                    {m.done} / {m.due}
                  </TableCell>
                  <TableCell className="tabular text-right text-body-strong">{m.percent}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Block>
      </main>
    </div>
  );
}
