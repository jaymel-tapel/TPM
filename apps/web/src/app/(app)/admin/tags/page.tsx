import Link from "next/link";
import { PageHeader, Panel, SectionHeader, TagBadge } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { listTagsWithUse } from "@/queries/tasks";
import { TagRow } from "@/components/tag-row";

export const dynamic = "force-dynamic";

/**
 * The department's tags.
 *
 * Nobody creates one here — a tag is made by typing it on a task, which is
 * what keeps the vocabulary a record of how people actually file work rather
 * than a taxonomy somebody sat down and designed. What this screen is for is
 * the two things you cannot do from a task: fix a name everybody is now
 * spelling differently, and take one out of circulation.
 */
export default async function AdminTagsPage() {
  const { user } = await requireSession();
  await assertCanAdminister(user);

  const tags = await listTagsWithUse();
  const live = tags.filter((t) => t.archivedAt === null);
  const retired = tags.filter((t) => t.archivedAt !== null);

  return (
    <>
      <PageHeader
        title="Tags"
        subtitle="Made by typing one on a task. Renamed and retired here."
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
      />

      <SectionHeader aside={`${live.length} ${live.length === 1 ? "tag" : "tags"}`}>
        In use
      </SectionHeader>
      <Panel className="mb-10">
        <ul className="divide-y divide-gray-300">
          {live.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
          {live.length === 0 ? (
            <li className="px-4 py-6 text-body text-gray-600">
              No tags yet. Type one on a task and it will appear here.
            </li>
          ) : null}
        </ul>
      </Panel>

      {retired.length > 0 ? (
        <>
          <SectionHeader aside={`${retired.length}`}>Retired</SectionHeader>
          <Panel className="mb-10">
            <ul className="divide-y divide-gray-300">
              {retired.map((tag) => (
                <TagRow key={tag.id} tag={tag} />
              ))}
            </ul>
          </Panel>
        </>
      ) : null}

      <p className="max-w-prose text-caption text-gray-600">
        Nothing is deleted here either. Retiring a tag stops it being offered on
        new work and leaves it on the {" "}
        <TagBadge>tasks that already carry it</TagBadge>, because what was done
        last quarter should not change because somebody tidied a list this
        morning. Renaming a tag to one that already exists merges the two —
        which is usually what was meant. Filter links carry a tag&rsquo;s name,
        so a renamed tag makes an old <code>?tag=</code> link show an empty
        board.
      </p>
    </>
  );
}
