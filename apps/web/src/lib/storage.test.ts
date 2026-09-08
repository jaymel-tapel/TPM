import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, dispositionFor, isAllowedType, keyFor } from "./storage";

const TASK = "11111111-1111-1111-1111-111111111111";

describe("keyFor", () => {
  it("scopes the key to the task", () => {
    expect(keyFor(TASK, "brief.pdf")).toMatch(new RegExp(`^tasks/${TASK}/[0-9a-f-]{36}\\.pdf$`));
  });

  it("never puts the filename in the key", () => {
    // The name is user input and the key is a path. Keeping them apart is what
    // stops a traversal, a collision, or a leak of the name into a URL.
    expect(keyFor(TASK, "../../etc/passwd")).not.toContain("passwd");
    expect(keyFor(TASK, "../../etc/passwd")).not.toContain("..");
    expect(keyFor(TASK, "Q4 budget (final) v2.xlsx")).not.toContain(" ");
  });

  it("gives two uploads of the same file different keys", () => {
    expect(keyFor(TASK, "a.png")).not.toBe(keyFor(TASK, "a.png"));
  });

  it("drops an extension it cannot vouch for", () => {
    expect(keyFor(TASK, "archive.tar.gz")).toMatch(/\.gz$/);
    expect(keyFor(TASK, "noextension")).toMatch(new RegExp(`^tasks/${TASK}/[0-9a-f-]{36}$`));

    /*
     * A separator in the filename must not become a separator in the key.
     * Asserting the shape rather than the absence of a substring: the earlier
     * version checked the key did not contain "/b", which failed roughly one
     * run in sixteen — whenever the random UUID happened to start with a "b".
     */
    expect(keyFor(TASK, "weird.a/b").split("/")).toHaveLength(3);
  });
});

describe("isAllowedType", () => {
  it("accepts the everyday attachments", () => {
    for (const type of ["image/png", "application/pdf", "text/csv"]) {
      expect(isAllowedType(type)).toBe(true);
    }
  });

  it("refuses anything a browser would execute", () => {
    // SVG is excluded on purpose: it is a document that can carry script, and
    // it is the one image type that could not be served inline safely.
    for (const type of ["text/html", "application/javascript", "image/svg+xml"]) {
      expect(isAllowedType(type)).toBe(false);
    }
  });
});

describe("dispositionFor", () => {
  it("renders images inline so a description can show them", () => {
    expect(dispositionFor("image/png", "hero.png")).toBe('inline; filename="hero.png"');
  });

  it("downloads everything else", () => {
    expect(dispositionFor("application/pdf", "brief.pdf")).toBe(
      'attachment; filename="brief.pdf"',
    );
  });

  it("cannot have its header terminated by a filename", () => {
    expect(dispositionFor("application/pdf", 'a".pdf\r\nX-Evil: 1')).toBe(
      'attachment; filename="a.pdfX-Evil: 1"',
    );
  });
});

it("caps uploads at 25 MB", () => {
  expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
});
