"use client";

import { createReactInlineContentSpec } from "@blocknote/react";
import { DOC_MENTION, USER_MENTION } from "./blocks";

/**
 * A document referenced from inside prose — what `@` leaves behind.
 *
 * `content: "none"` because the chip is not editable text: the title is a prop,
 * not something you retype. That is also why the title is stored rather than
 * looked up. A document can be deleted, or belong to a team the reader is not
 * on; keeping the name in the description means the sentence still reads, and
 * the chip degrades to plain grey rather than to a dead link or a 404 nobody
 * can explain. The body is what visibility protects, and the body is not here.
 */
export const docMention = createReactInlineContentSpec(
  {
    type: DOC_MENTION,
    propSchema: {
      docId: { default: "" },
      title: { default: "" },
      // Set by the server when it renders a document the reader may not open,
      // or one that no longer exists.
      stale: { default: false },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => {
      const { docId, title, stale } = inlineContent.props;
      const label = title || "Untitled document";

      if (stale || !docId) {
        return (
          <span
            title="This document is no longer available to you."
            className="rounded-sm bg-gray-100 px-1 py-0.5 text-caption text-gray-700"
          >
            {label}
          </span>
        );
      }

      return (
        <a
          href={`/docs/${docId}`}
          className="rounded-sm bg-blue-100 px-1 py-0.5 text-caption text-blue-900 hover:bg-blue-200"
        >
          {label}
        </a>
      );
    },
  },
);

/**
 * A person referenced from inside prose. Same bargain as a document: the name
 * is a prop rather than a lookup, so the sentence still reads when the reader
 * cannot see that person's team, or the account is gone.
 *
 * It links to their day rather than rendering inert, because "who is this and
 * what are they working on" is the question a name in a comment provokes.
 */
export const userMention = createReactInlineContentSpec(
  {
    type: USER_MENTION,
    propSchema: {
      userId: { default: "" },
      name: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => {
      const { userId, name } = inlineContent.props;
      const label = name || "Someone";

      if (!userId) {
        return (
          <span className="rounded-sm bg-gray-100 px-1 py-0.5 text-caption text-gray-700">
            @{label}
          </span>
        );
      }

      return (
        <a
          href={`/team/${userId}`}
          className="rounded-sm bg-amber-100 px-1 py-0.5 text-caption text-amber-1000 hover:bg-amber-200"
        >
          @{label}
        </a>
      );
    },
  },
);
