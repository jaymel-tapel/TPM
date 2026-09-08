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
      return "";
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
