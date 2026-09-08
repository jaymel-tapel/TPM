import { describe, expect, it } from "vitest";
import { isEmptyDocument, toBlocks, toPlainText } from "@meridian/ui/editor";

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
