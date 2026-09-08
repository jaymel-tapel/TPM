"use client";

import { useRouter } from "next/navigation";
import { AttachmentList, type AttachmentData } from "@meridian/ui";
import { deleteAttachment } from "@/actions/attachments";

/**
 * One POST carries the file, and the response carries back where to read it.
 * The editor's drag-and-drop and the attachment list both call this, so a file
 * is recorded the same way whether it was dropped into the prose or onto the
 * list.
 */
export async function uploadAttachment(taskId: string, file: File) {
  const body = new FormData();
  body.set("taskId", taskId);
  body.set("file", file);

  const response = await fetch("/api/attachments/upload", { method: "POST", body });
  if (!response.ok) {
    // The route explains itself in `error`; fall back only if it could not.
    const message = await response
      .json()
      .then((d: { error?: string }) => d.error)
      .catch(() => null);
    throw new Error(message ?? "The file could not be uploaded.");
  }

  return (await response.json()) as { id: string; href: string };
}

export function TaskAttachments({
  taskId,
  attachments,
  editable,
}: {
  taskId: string;
  attachments: AttachmentData[];
  editable: boolean;
}) {
  const router = useRouter();

  return (
    <AttachmentList
      attachments={attachments}
      onDelete={editable ? deleteAttachment : undefined}
      onUpload={
        editable
          ? async (file) => {
              await uploadAttachment(taskId, file);
              // The list is server-rendered, so the new row arrives with the
              // refresh rather than being spliced in here.
              router.refresh();
            }
          : undefined
      }
    />
  );
}
