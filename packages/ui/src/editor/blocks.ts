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
export const USER_MENTION = "userMention";

/** The props a mention carries. `title` is remembered so a document that has
 * since been deleted still reads as a name rather than a dead id. */
export type DocMentionProps = { docId: string; title: string };

/** The props a person mention carries. Same bargain as a document's title:
 *  the name is remembered so the sentence still reads if the reader cannot see
 *  that person, or the row is gone. */
export type UserMentionProps = { userId: string; name: string };

/**
 * One row in the `@` picker. `kind` decides which chip gets inserted — people
 * and documents share one menu because they share one trigger, and asking
 * someone to remember two keystrokes for "point at a thing" is a worse idea
 * than one list with two sorts of row in it.
 */
export type MentionItem = {
  id: string;
  title: string;
  subtitle?: string;
  kind: "doc" | "person";
};

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
      if (mention) return mention.title;
      const person = asPerson(node);
      return person ? person.name : "";
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

function asPerson(node: unknown): UserMentionProps | null {
  if (!node || typeof node !== "object") return null;
  const { type, props } = node as { type?: unknown; props?: unknown };
  if (type !== USER_MENTION || !props || typeof props !== "object") return null;
  const { userId, name } = props as { userId?: unknown; name?: unknown };
  if (typeof userId !== "string" || !userId) return null;
  return { userId, name: typeof name === "string" ? name : "" };
}

/**
 * Every mention of one kind in a stored body, in the order it appears and
 * without repeats.
 *
 * The walk is shared because the two callers must agree: if documents and
 * people were scanned by different recursions, a mention nested inside a list
 * item could count for one and not the other.
 */
function collect<T>(
  value: string | null | undefined,
  read: (node: unknown) => T | null,
  keyOf: (item: T) => string,
): T[] {
  const blocks = toBlocks(value);
  if (!blocks) return [];

  const found = new Map<string, T>();
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (Array.isArray(block.content)) {
        for (const node of block.content) {
          const item = read(node);
          if (item && !found.has(keyOf(item))) found.set(keyOf(item), item);
        }
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return [...found.values()];
}

/**
 * Every document a stored description mentions.
 *
 * This is what turns prose into rows in `task_documents`, so it runs on the
 * server on every save — which is why it lives beside `toBlocks` as a plain
 * function rather than inside the editor that writes the mentions.
 */
export function collectMentions(
  value: string | null | undefined,
): DocMentionProps[] {
  return collect(value, asMention, (m) => m.docId);
}

/**
 * Every person a stored body mentions — a description or a comment.
 *
 * The `userId` here came out of the browser, so it is the author's *claim*
 * about who they meant, not a fact. Anything acting on it has to check the
 * named person may actually see the task first; see `notify` in the app.
 */
export function collectPeople(
  value: string | null | undefined,
): UserMentionProps[] {
  return collect(value, asPerson, (p) => p.userId);
}
