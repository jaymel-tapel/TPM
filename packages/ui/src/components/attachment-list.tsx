"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, Table2, X } from "lucide-react";
import { cn } from "../lib/utils";

export type AttachmentData = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string;
  href: string;
};

/** Bytes as people read them. Kilobytes are decimal here, as on every OS. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function FileIcon({ contentType }: { contentType: string }) {
  const className = "size-4 shrink-0 text-gray-700";
  if (contentType.startsWith("image/")) return <ImageIcon className={className} />;
  if (contentType.includes("spreadsheet") || contentType.includes("csv")) {
    return <Table2 className={className} />;
  }
  return <FileText className={className} />;
}

type Pending = { name: string; error?: string };

export function AttachmentList({
  attachments,
  onUpload,
  onDelete,
}: {
  attachments: AttachmentData[];
  /** Uploads one file and resolves once it is recorded. Omit to hide the drop zone. */
  onUpload?: (file: File) => Promise<void>;
  /** Server action taking `attachmentId`. */
  onDelete?: (formData: FormData) => void | Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const input = useRef<HTMLInputElement>(null);
  // Nested drag events fire on every child; counting enter and leave is the
  // only way the highlight does not flicker as the cursor crosses a row.
  const depth = useRef(0);

  async function accept(files: FileList | null) {
    if (!onUpload || !files || files.length === 0) return;
    const list = Array.from(files);
    setPending((p) => [...p, ...list.map((f) => ({ name: f.name }))]);

    for (const file of list) {
      try {
        await onUpload(file);
        setPending((p) => p.filter((item) => item.name !== file.name));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setPending((p) =>
          p.map((item) => (item.name === file.name ? { ...item, error: message } : item)),
        );
      }
    }
  }

  return (
    <div
      onDragEnter={(e) => {
        if (!onUpload) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => onUpload && e.preventDefault()}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (!onUpload) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        void accept(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border transition-colors",
        dragging ? "border-blue-700 bg-blue-100" : "border-gray-400 bg-background-100",
      )}
    >
      <div className="flex items-center gap-2 border-b border-gray-300 px-4 py-3">
        <Paperclip className="size-4 text-gray-700" />
        <h2 className="text-body-strong text-gray-1000">Attachments</h2>
        <span className="tabular ml-auto text-caption text-gray-600">
          {attachments.length}
        </span>
      </div>

      {attachments.length === 0 && pending.length === 0 ? (
        <p className="px-4 py-6 text-center text-caption text-gray-600">
          Nothing attached yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-300">
          {attachments.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <FileIcon contentType={file.contentType} />
              <a
                href={file.href}
                className="min-w-0 flex-1 truncate text-body text-gray-1000 underline-offset-2 hover:underline"
              >
                {file.filename}
              </a>
              <span className="tabular shrink-0 text-caption text-gray-600">
                {formatBytes(file.sizeBytes)}
              </span>
              <span className="hidden shrink-0 text-caption text-gray-600 sm:inline">
                {file.uploadedByName}
              </span>
              {onDelete ? (
                <form action={onDelete}>
                  <input type="hidden" name="attachmentId" value={file.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${file.filename}`}
                    className="rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-700"
                  >
                    <X className="size-4" />
                  </button>
                </form>
              ) : null}
            </li>
          ))}

          {pending.map((item) => (
            <li
              key={`pending-${item.name}`}
              className="flex items-center gap-3 px-4 py-3 text-body"
            >
              <FileIcon contentType="" />
              <span className="min-w-0 flex-1 truncate text-gray-600">{item.name}</span>
              {item.error ? (
                <span className="shrink-0 text-caption text-red-700">{item.error}</span>
              ) : (
                <span className="shrink-0 text-caption text-gray-600">Uploading…</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {onUpload ? (
        <div className="border-t border-dashed border-gray-400 px-4 py-3 text-center">
          <input
            ref={input}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              void accept(e.target.files);
              e.target.value = ""; // So the same file can be picked twice.
            }}
          />
          <p className="text-caption text-gray-600">
            Drop files here, or{" "}
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="text-blue-900 underline underline-offset-2"
            >
              browse
            </button>
            . Up to 25 MB each.
          </p>
        </div>
      ) : null}
    </div>
  );
}
