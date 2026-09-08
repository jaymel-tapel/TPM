"use client";

import { useRouter } from "next/navigation";
import { AttachmentList, type AttachmentData } from "@meridian/ui";
import { beginUpload, deleteAttachment, finishUpload } from "@/actions/attachments";

/**
 * The upload conversation, in one place: ask the server for a target, PUT the
 * bytes straight at it, then tell the server they landed. The editor's
 * drag-and-drop and this list both go through `uploadAttachment`, so a file is
 * recorded the same way whether it was dropped into the prose or onto the list.
 */
export async function uploadAttachment(taskId: string, file: File) {
  const contentType = file.type || "application/octet-stream";
  const begun = await beginUpload({
    taskId,
    filename: file.name,
    contentType,
    sizeBytes: file.size,
  });
  if (!begun.ok) throw new Error(begun.error);

  const response = await fetch(begun.url, {
    method: "PUT",
    headers: begun.headers,
    body: file,
  });
  if (!response.ok) throw new Error("The file could not be uploaded.");

  return finishUpload({
    taskId,
    key: begun.key,
    filename: file.name,
    contentType,
    sizeBytes: file.size,
  });
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
