// The components are client-only and load on demand; the block helpers are
// plain functions that the server, the tests and the seed all use.
export { RichTextEditor, RichTextView } from "./lazy";
export {
  collectMentions,
  collectPeople,
  isEmptyDocument,
  toBlocks,
  toPlainText,
  DOC_MENTION,
  USER_MENTION,
  type Block,
  type DocMentionProps,
  type UserMentionProps,
  type MentionItem,
} from "./blocks";
