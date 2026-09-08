import "server-only";
import Ably from "ably";

/**
 * Telling a browser that something changed, without holding a socket.
 *
 * There is no long-lived process here to hold one — Neon plus serverless means
 * a request ends and the container may go. So the browser holds a connection
 * to Ably, and this app only ever publishes to it over REST from a server
 * action. Nothing has to stay warm.
 *
 * What travels is a *ping and nothing else*. The message says "look again";
 * the content then arrives through the normal server render, past
 * `requireUser()` and `canViewTask`, by the same query a cold page load runs.
 * Putting the task title in the message would open a second data path with its
 * own authorization story, and a channel misconfigured tomorrow would leak
 * content rather than an empty wake-up. It also leaves nothing to keep
 * coherent: the database stays the only source of what the inbox says.
 */
export const NUDGE = "nudge";

/** One person's channel. Also the unit a subscribe token is scoped to. */
export const userChannel = (userId: string) => `user:${userId}`;

const key = process.env.ABLY_API_KEY;

/**
 * Missing configuration is announced, not swallowed — but it does not stop the
 * app.
 *
 * `storage()` in ./storage.ts is the cautionary case: its comment says a
 * misconfigured production "should fail loudly rather than quietly start
 * writing files onto a container's disk", and then it quietly does exactly
 * that, losing every upload. Silence there costs data.
 *
 * Silence here would only cost *immediacy*: the rows are written either way,
 * and a recipient still sees them on their next navigation. So this says so
 * once, clearly, rather than refusing to boot over a degraded nicety — and
 * rather than throwing during `next build`, which runs in production mode with
 * no secrets and would take CI down with it.
 */
if (!key && process.env.NODE_ENV === "production") {
  console.error(
    "[realtime] ABLY_API_KEY is not set. Notifications will still be recorded, " +
      "but nobody will be told until they navigate. Set it to enable live delivery.",
  );
}

let warned = false;

const rest = key ? new Ably.Rest(key) : null;

/** Whether the browser should bother connecting. Read by the layout. */
export const realtimeEnabled = Boolean(key);

/**
 * Wake these people up.
 *
 * Never call this inside the transaction that wrote the rows. A publish that
 * lands and is then rolled back tells somebody about a notification that does
 * not exist, and there is no way to take it back.
 *
 * Failure here is not failure of the write. The rows are in the database and
 * the recipient will see them on their next navigation, so a dropped ping
 * degrades to how the app behaved before Ably rather than losing anything.
 */
export async function publishToUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  if (!rest) {
    if (!warned) {
      warned = true;
      console.warn("[realtime] not configured — badges update on navigation only.");
    }
    return;
  }

  await Promise.all(
    [...new Set(userIds)].map(async (id) => {
      try {
        await rest.channels.get(userChannel(id)).publish(NUDGE, {});
      } catch (error) {
        console.error("[realtime] could not nudge", id, error);
      }
    }),
  );
}

/**
 * A token this person's browser may hold, good for listening to their own
 * inbox and nothing else.
 *
 * The capability is the whole security boundary. `subscribe` only, so a client
 * cannot publish a fake nudge; one channel only, so it cannot listen to
 * anybody else's. The id comes from the session — never from the request, or
 * this hands out a token for whoever is asked for.
 */
export async function tokenRequestFor(userId: string) {
  if (!rest) return null;
  return rest.auth.createTokenRequest({
    clientId: userId,
    capability: { [userChannel(userId)]: ["subscribe"] },
  });
}
