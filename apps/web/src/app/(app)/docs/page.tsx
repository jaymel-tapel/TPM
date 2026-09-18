import { Search } from "lucide-react";
import { Input } from "@tpm/ui/primitives/input";
import { ButtonLink, DocSearchResults, DocTree, PageHeader } from "@tpm/ui";
import { requireSession } from "@/lib/auth";
import { canCreateDocs } from "@/lib/permissions";
import { getDocTree, searchDocs } from "@/queries/docs";
import { toDocFolder, toDocHit, toDocNode } from "@/lib/present";

export const dynamic = "force-dynamic";

/**
 * The tree, or the hits when there is a query.
 *
 * Search is a plain GET form, so the URL is the query: a result is linkable,
 * the back button does what it looks like it does, and the page stays
 * server-rendered like every other screen here.
 */
export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await requireSession();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [tree, hits] = await Promise.all([
    query ? Promise.resolve({ folders: [], documents: [] }) : getDocTree(user),
    query ? searchDocs(user, query) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Docs"
        subtitle="What the work refers to, written down once."
        aside={
          canCreateDocs(user) ? (
            <div className="flex items-center gap-3">
              <ButtonLink href="/docs/folders/new" variant="ghost">
                New folder
              </ButtonLink>
              <ButtonLink href="/docs/new">New document</ButtonLink>
            </div>
          ) : null
        }
        commands={
          <form action="/docs" className="flex max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-gray-600"
                strokeWidth={1.75}
              />
              <Input
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search titles and text"
                aria-label="Search documents"
                className="pl-8"
              />
            </div>
          </form>
        }
      />

      {query ? (
        <DocSearchResults hits={hits.map(toDocHit)} query={query} />
      ) : (
        <DocTree
          folders={tree.folders.map(toDocFolder)}
          documents={tree.documents.map(toDocNode)}
          empty="No folders or documents yet."
        />
      )}
    </>
  );
}
