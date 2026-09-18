"use client";

import { useCallback, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/ariakit";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
// The Ariakit skin rather than the Mantine one: @mantine/hooks@9 calls
// React's `useEffectEvent`, which does not exist in React 19.2, so BlockNote's
// default build threw the moment any menu rendered. Ariakit has no such
// dependency. The stylesheet is overridden wholesale below anyway.
import "@blocknote/ariakit/style.css";
import "./blocknote.css";
import { cn } from "../lib/utils";
import { type Block, DOC_MENTION, USER_MENTION, type MentionItem, toBlocks } from "./blocks";
import { editorSchema } from "./schema";

/**
 * BlockNote, wearing our tokens. It is imported here and nowhere else so the
 * editor's weight lands only on the two routes that mount it — the same reason
 * the chart lives behind its own entry point.
 *
 * The value is mirrored into a hidden input rather than held in React state
 * that the form reads: the surrounding form is a plain server action, and a
 * hidden input is what a server action can actually see.
 */
export function RichTextEditor({
  name,
  defaultValue,
  placeholder = "Optional context",
  uploadFile,
  mentionSource,
  className,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  /** Returns the URL the uploaded file can be read back from. */
  uploadFile?: (file: File) => Promise<string>;
  /**
   * Documents matching what has been typed after `@`. This package renders and
   * never queries, so the search is handed in — the app side calls a server
   * action that scopes it to what the author is allowed to see, and the picker
   * can only ever offer those.
   */
  mentionSource?: (query: string) => Promise<MentionItem[]>;
  className?: string;
}) {
  const initial = toBlocks(defaultValue);
  const [value, setValue] = useState(() =>
    initial ? JSON.stringify(initial) : "",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Kept in a ref so a re-render never swaps the handler the editor captured
  // when it was created.
  const upload = useRef(uploadFile);
  upload.current = uploadFile;

  const handleUpload = useCallback(async (file: File) => {
    if (!upload.current) throw new Error("Uploads are not available here.");
    setUploadError(null);
    try {
      return await upload.current(file);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      throw error;
    }
  }, []);

  // Kept in a ref for the same reason as `upload`, and for a sharper one:
  // BlockNote lists `getItems` in a `useEffect` dependency array, so a handler
  // with a new identity on every render re-queries forever while the menu is
  // open. The ref is what lets `getMentionItems` below be memoised once.
  const search = useRef(mentionSource);
  search.current = mentionSource;

  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent: initial as never,
    // Only the empty document prompts. BlockNote's per-block default
    // ("Enter text or type '/' for commands") sits under every paragraph you
    // finish, which in a form field reads as an unfilled second input.
    placeholders: { emptyDocument: placeholder, default: "" },
    uploadFile: uploadFile ? handleUpload : undefined,
  });

  const getMentionItems = useCallback(
    async (query: string) => {
      const items = (await search.current?.(query)) ?? [];
      return items.map((item) => ({
        title: item.title,
        subtext: item.subtitle,
        // People and documents share the `@` menu, so the row decides which
        // chip it leaves behind. Asking anyone to remember two triggers for
        // "point at a thing" would be a worse idea than one mixed list.
        onItemClick: () =>
          // The trailing space is what lets you carry on typing after the chip
          // rather than landing inside it.
          editor.insertInlineContent([
            item.kind === "person"
              ? { type: USER_MENTION, props: { userId: item.id, name: item.title } }
              : { type: DOC_MENTION, props: { docId: item.id, title: item.title, stale: false } },
            " ",
          ]),
      }));
    },
    [editor],
  );

  return (
    <div className={cn("tpm-editor", className)}>
      <input type="hidden" name={name} value={value} />
      {/*
        No side menu. Its + and drag handles live in a 54px gutter, which
        pushed the description text a hundred pixels right of the Title field
        directly above it — the field stopped looking like the others. This is
        a description, not a document: the formatting toolbar on selection and
        the slash menu both stay, and reordering paragraphs by dragging is not
        worth breaking the form's alignment for.
      */}
      <BlockNoteView
        editor={editor}
        theme="light"
        sideMenu={false}
        onChange={() => setValue(JSON.stringify(editor.document))}
      >
        {mentionSource ? (
          /*
           * Additive, not a replacement: BlockNoteView renders its default UI
           * and then its children, so the formatting toolbar and the slash menu
           * are both still there.
           *
           * The items are shaped as BlockNote's own suggestion item, which
           * makes the default menu render them — the same menu the slash
           * commands use, already wearing this system's tokens through
           * `blocknote.css`. A bespoke component here would be a second popover
           * to keep in step for no gain.
           */
          <SuggestionMenuController
            triggerCharacter="@"
            getItems={getMentionItems}
            minQueryLength={0}
          />
        ) : null}
      </BlockNoteView>
      {uploadError ? (
        <p role="alert" className="mt-2 text-caption text-red-700">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The same document, read-only. Rendered by BlockNote rather than by a
 * separate serialiser so what you wrote is exactly what you read back.
 */
export function RichTextView({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const blocks = toBlocks(value);
  const editor = useCreateBlockNote({ schema: editorSchema, initialContent: blocks as never });

  return (
    <div className={cn("tpm-editor tpm-editor--read-only", className)}>
      <BlockNoteView editor={editor} theme="light" editable={false} />
    </div>
  );
}

export type { Block, MentionItem };
