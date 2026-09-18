import { describe, expect, it } from "vitest";
import {
  collectMentions,
  collectPeople,
  isEmptyDocument,
  toBlocks,
  toPlainText,
} from "@tpm/ui/editor";

describe("toBlocks", () => {
  it("reads a stored BlockNote document back", () => {
    const doc = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "Move the launch up.", styles: {} }] },
    ]);
    expect(toBlocks(doc)).toHaveLength(1);
    expect(toPlainText(doc)).toBe("Move the launch up.");
  });

  it("treats a legacy plain-text description as prose", () => {
    // Rows written before the editor existed, and everything the seed writes,
    // are plain sentences. They have to open in the editor, not as raw text.
    const blocks = toBlocks("Client wants the deck by Friday.");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Client wants the deck by Friday.", styles: {} }],
      },
    ]);
  });

  it("splits legacy text on blank lines", () => {
    expect(toBlocks("First para.\n\nSecond para.")).toHaveLength(2);
  });

  it("falls back to prose when the JSON is broken", () => {
    expect(toPlainText("[not really json")).toBe("[not really json");
  });

  it("has nothing to show for an empty column", () => {
    expect(toBlocks(null)).toBeUndefined();
    expect(toBlocks("   ")).toBeUndefined();
  });
});

describe("isEmptyDocument", () => {
  it("is true for an editor that was opened and left alone", () => {
    expect(isEmptyDocument(JSON.stringify([{ type: "paragraph", content: [] }]))).toBe(true);
  });

  it("is false when the only content is a file", () => {
    // A description holding just a dropped image is not empty.
    const doc = JSON.stringify([{ type: "image", props: { url: "/api/attachments/x" } }]);
    expect(isEmptyDocument(doc)).toBe(false);
  });
});

/** A mention, as the editor writes it into the stored document. */
const mention = (docId: string, title: string) => ({
  type: "docMention",
  props: { docId, title, stale: false },
});

describe("collectMentions", () => {
  it("finds the documents a description names, in order and without repeats", () => {
    const doc = JSON.stringify([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Follow ", styles: {} },
          mention("d1", "Brand"),
          { type: "text", text: " and ", styles: {} },
          mention("d2", "Tone"),
        ],
      },
      {
        type: "bulletListItem",
        content: [mention("d1", "Brand")],
      },
    ]);
    expect(collectMentions(doc)).toEqual([
      { docId: "d1", title: "Brand" },
      { docId: "d2", title: "Tone" },
    ]);
  });

  it("looks inside nested blocks", () => {
    const doc = JSON.stringify([
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Steps", styles: {} }],
        children: [{ type: "bulletListItem", content: [mention("d9", "Runbook")] }],
      },
    ]);
    expect(collectMentions(doc)).toEqual([{ docId: "d9", title: "Runbook" }]);
  });

  it("has nothing to say about prose, emptiness or broken JSON", () => {
    expect(collectMentions("Client wants the deck by Friday.")).toEqual([]);
    expect(collectMentions(null)).toEqual([]);
    expect(collectMentions("[not really json")).toEqual([]);
  });

  it("ignores a mention with no document behind it", () => {
    const doc = JSON.stringify([
      { type: "paragraph", content: [{ type: "docMention", props: { docId: "", title: "x" } }] },
    ]);
    expect(collectMentions(doc)).toEqual([]);
  });
});

describe("a mention counts as text", () => {
  const doc = JSON.stringify([
    {
      type: "paragraph",
      content: [{ type: "text", text: "Follow ", styles: {} }, mention("d1", "Brand guidelines")],
    },
  ]);

  it("reads its title, so search and previews keep the only word that mattered", () => {
    expect(toPlainText(doc)).toBe("Follow Brand guidelines");
  });

  it("means a description that is only a chip is not empty", () => {
    const only = JSON.stringify([
      { type: "paragraph", content: [mention("d1", "Brand guidelines")] },
    ]);
    expect(isEmptyDocument(only)).toBe(false);
  });
});

describe("collectPeople", () => {
  const person = (userId: string, name: string) => ({
    type: "userMention",
    props: { userId, name },
  });

  it("finds the people a body names, in order and without repeats", () => {
    const doc = JSON.stringify([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "over to ", styles: {} },
          person("u1", "Anna Santos"),
          { type: "text", text: " and ", styles: {} },
          person("u2", "James Cruz"),
        ],
      },
      { type: "bulletListItem", content: [person("u1", "Anna Santos")] },
    ]);
    expect(collectPeople(doc)).toEqual([
      { userId: "u1", name: "Anna Santos" },
      { userId: "u2", name: "James Cruz" },
    ]);
  });

  it("looks inside nested blocks, the way the document walk does", () => {
    const doc = JSON.stringify([
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "Steps", styles: {} }],
        children: [{ type: "bulletListItem", content: [person("u9", "Mika")] }],
      },
    ]);
    expect(collectPeople(doc)).toEqual([{ userId: "u9", name: "Mika" }]);
  });

  it("keeps the two kinds of mention apart", () => {
    // A body mentioning a document must not notify anyone, and a body
    // mentioning a person must not link a document.
    const doc = JSON.stringify([
      {
        type: "paragraph",
        content: [mention("d1", "Brand"), person("u1", "Anna Santos")],
      },
    ]);
    expect(collectPeople(doc)).toEqual([{ userId: "u1", name: "Anna Santos" }]);
    expect(collectMentions(doc)).toEqual([{ docId: "d1", title: "Brand" }]);
  });

  it("has nothing to say about prose, emptiness or broken JSON", () => {
    expect(collectPeople("Client wants the deck by Friday.")).toEqual([]);
    expect(collectPeople(null)).toEqual([]);
    expect(collectPeople("[not really json")).toEqual([]);
  });
});
