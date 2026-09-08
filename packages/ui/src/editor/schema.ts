import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
import { docMention, userMention } from "./mention";

/**
 * One schema, shared by the editor and the read-only view.
 *
 * It has to be shared. The two already render through the same BlockNote
 * instance so that what you wrote is exactly what you read back; if the view
 * did not know about `docMention` or `userMention`, every description or
 * comment containing one would throw on unknown inline content the moment
 * somebody opened the task.
 */
export const editorSchema = BlockNoteSchema.create({
  inlineContentSpecs: { ...defaultInlineContentSpecs, docMention, userMention },
});

export type EditorSchema = typeof editorSchema;
