import { sql, type SQL } from "drizzle-orm";

/**
 * Every table that holds *work*, in one place.
 *
 * The seed and the test fixture both need to clear the world before building
 * it, and they used to keep separate lists of what that meant. Both drifted —
 * the seed missed the chat tables when chat shipped, and `delete from users`
 * started failing on a foreign key that does not cascade. A hand-maintained
 * list in two files is a list that is wrong in at least one of them.
 *
 * Two tables are deliberately absent:
 *
 * - **`department`** is a single settings row, not data. A reseed should not
 *   move the department's timezone back to whatever the default was.
 * - **`task_types`** is a vocabulary. Migration 0020 seeds the six the enum
 *   used to hold, and anything an administrator has added since is theirs. A
 *   reseed replaces the work, not the words it is filed under.
 *
 * `cascade` handles the ordering, so this stays correct when a new table
 * arrives referencing one of these. `restart identity` matters only for the
 * few serial columns, and costs nothing where there are none.
 */
const TABLES = [
  "chat_messages",
  "chat_members",
  "chat_rooms",
  "leave_requests",
  "task_schedule",
  "notifications",
  "task_activity",
  "task_documents",
  "documents",
  "folders",
  "task_tags",
  "task_assignees",
  "task_attachments",
  "tasks",
  "campaigns",
  "board_statuses",
  "boards",
  "tags",
  "account_members",
  "users",
  "accounts",
] as const;

/** Empties everything above in one statement. */
export const truncateAllData: SQL = sql.raw(
  `truncate ${TABLES.join(", ")} restart identity cascade`,
);
