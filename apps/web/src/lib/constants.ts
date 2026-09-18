/**
 * Labels and enums that are presentation live in `@tpm/ui`. What is left
 * here is app-side only.
 */
export {
  PRIORITY_LABELS,
  PRIORITIES,
  ROLE_BADGES,
  ROLE_LABELS,
} from "@tpm/ui";

/** The one password every seeded demo account shares. */
export const DEMO_PASSWORD = "demo1234";

/**
 * How many levels of pieces a task may be broken into. The root is zero, so
 * five means a leaf can sit five rows in from the task you opened.
 *
 * Here rather than beside `createSubtask`, which enforces it: a `"use server"`
 * module may export nothing but async functions, the same reason `rank.ts`
 * exists. Both the action and the page that hides the adder read it, and they
 * have to agree — offering a control the server would refuse is worse than not
 * offering it.
 */
export const MAX_SUBTASK_DEPTH = 5;
