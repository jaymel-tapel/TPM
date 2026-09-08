import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { tokenRequestFor } from "@/lib/realtime";

/**
 * What the browser is allowed to listen to.
 *
 * The client never holds `ABLY_API_KEY` — it holds a short-lived token minted
 * here, whose capability is `subscribe` on one channel: the signed-in user's
 * own. So a client cannot publish a forged nudge, and cannot listen to anybody
 * else's inbox.
 *
 * The id comes from the session and never from the request. Reading it from a
 * query parameter would turn this route into "mint me a token for whoever I
 * name", which is the whole attack.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const request = await tokenRequestFor(session.user.id);
  // Not configured. Not an error — the app falls back to updating on
  // navigation, and the client treats this as "do not connect".
  if (!request) return new NextResponse(null, { status: 204 });

  return NextResponse.json(request, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
