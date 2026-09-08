"use client";

import { useCallback, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/ariakit";
import { useCreateBlockNote } from "@blocknote/react";
// The Ariakit skin rather than the Mantine one: @mantine/hooks@9 calls
// React's `useEffectEvent`, which does not exist in React 19.2, so BlockNote's
// default build threw the moment any menu rendered. Ariakit has no such
// dependency. The stylesheet is overridden wholesale below anyway.
import "@blocknote/ariakit/style.css";
import "./blocknote.css";
import { cn } from "../lib/utils";
import { type Block, toBlocks } from "./blocks";

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
  className,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  /** Returns the URL the uploaded file can be read back from. */
  uploadFile?: (file: File) => Promise<string>;
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

  const editor = useCreateBlockNote({
    initialContent: initial as never,
    // Only the empty document prompts. BlockNote's per-block default
    // ("Enter text or type '/' for commands") sits under every paragraph you
    // finish, which in a form field reads as an unfilled second input.
    placeholders: { emptyDocument: placeholder, default: "" },
    uploadFile: uploadFile ? handleUpload : undefined,
  });

  return (
    <div className={cn("meridian-editor", className)}>
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
      />
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
  const editor = useCreateBlockNote({ initialContent: blocks as never });

  return (
    <div className={cn("meridian-editor meridian-editor--read-only", className)}>
      <BlockNoteView editor={editor} theme="light" editable={false} />
    </div>
  );
}

export type { Block };
