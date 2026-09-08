/**
 * The description column stores a BlockNote document as JSON text. It used to
 * store plain text, and the seed still writes plain sentences, so nothing
 * assumes the JSON is there: `toBlocks` accepts either and `toPlainText`
 * flattens back for anywhere a preview or a search needs a string.
 *
 * This avoids a data migration that would have had to guess at the intent of
 * every existing row, and it keeps the column honest if something writes to it
 * outside the editor.
 */

/** BlockNote's own block shape, loosely typed — we only ever pass it through. */
export type Block = { type?: string; content?: unknown; children?: Block[] };

/**
 * The inline node a `@`-mention leaves behind. Named here rather than in the
 * React spec that draws it, because the server, the seed and the tests all read
 * documents without ever loading an editor.
 */
export const DOC_MENTION = "docMention";

/** The props a mention carries. `title` is remembered so a document that has
 * since been deleted still reads as a name rather than a dead id. */
export type DocMentionProps = { docId: string; title: string };

/** One row in the `@` picker, as the app hands it to the editor. */
export type MentionItem = { id: string; title: string; subtitle?: string };

export function paragraph(text: string): Block {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text, styles: {} }] : [],
  } as Block;
}

export function toBlocks(value: string | null | undefined): Block[] | undefined {
  const raw = value?.trim();
  if (!raw) return undefined; // Let the editor start with its own empty block.

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Block[];
    } catch {
      // Not JSON after all — fall through and treat it as prose.
    }
  }
  return raw.split(/\n{2,}/).map(paragraph);
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((node) => {
      if (typeof node === "string") return node;
      if (node && typeof node === "object" && "text" in node) {
        return String((node as { text: unknown }).text ?? "");
      }
      // A mention reads as the document's name. Otherwise a description whose
      // point is "follow @Brand guidelines" would flatten to "follow", and
      // both the preview and the search index would lose the only word that
      // mattered.
      const mention = asMention(node);
      return mention ? mention.title : "";
    })
    .join("");
}

/** Flattens a document to prose. Used for previews, never for storage. */
export function toPlainText(value: string | null | undefined): string {
  const blocks = toBlocks(value);
  if (!blocks) return "";

  const lines: string[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      const line = textOf(block.content);
      if (line) lines.push(line);
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return lines.join("\n").trim();
}

export function isEmptyDocument(value: string | null | undefined): boolean {
  return toPlainText(value).length === 0 && !/"type"\s*:\s*"(image|file|video|audio|table)"/.test(value ?? "");
}

/** The mention node's props, or null if this is not one. */
function asMention(node: unknown): DocMentionProps | null {
  if (!node || typeof node !== "object") return null;
  const { type, props } = node as { type?: unknown; props?: unknown };
  if (type !== DOC_MENTION || !props || typeof props !== "object") return null;
  const { docId, title } = props as { docId?: unknown; title?: unknown };
  if (typeof docId !== "string" || !docId) return null;
  return { docId, title: typeof title === "string" ? title : "" };
}

/**
 * Every document a stored description mentions, in the order it mentions them
 * and without repeats.
 *
 * This is what turns prose into rows in `task_documents`, so it runs on the
 * server on every save — which is why it lives beside `toBlocks` as a plain
 * function rather than inside the editor that writes the mentions.
 */
export function collectMentions(
  value: string | null | undefined,
): DocMentionProps[] {
  const blocks = toBlocks(value);
  if (!blocks) return [];

  const found = new Map<string, DocMentionProps>();
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (Array.isArray(block.content)) {
        for (const node of block.content) {
          const mention = asMention(node);
          if (mention && !found.has(mention.docId)) found.set(mention.docId, mention);
        }
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return [...found.values()];
}
