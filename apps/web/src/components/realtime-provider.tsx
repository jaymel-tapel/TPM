"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BaseRealtime, FetchRequest, WebSocketTransport } from "ably/modular";

/**
 * Listens for "something changed" and asks the server what.
 *
 * The message carries nothing. `router.refresh()` re-renders the current route
 * on the server, so what appears is whatever that person is allowed to see,
 * fetched the same way a cold load would fetch it. Nothing arrives over the
 * socket that has not been through the permission layer.
 *
 * Authentication is the token endpoint, never a key in this bundle. The SDK
 * calls it on connect and again on expiry.
 */
export function RealtimeProvider({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    /*
     * The modular build, not the default one. The default entry is a prebuilt
     * bundle webpack cannot parse, and it carries the whole SDK — presence,
     * encryption, message history — none of which a one-message-type listener
     * needs. Two plugins is the whole surface: a socket, and a way to fetch
     * the token.
     */
    const client = new BaseRealtime({
      authUrl: "/api/ably/token",
      plugins: { WebSocketTransport, FetchRequest },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof client.channels.get> | undefined;

    const onNudge = () => {
      // Three assignments saved together arrive as three messages and should
      // cost one re-render.
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    /*
     * Wait for the connection before naming the channel: `clientId` is set by
     * the token the server minted, so it is only known once that token has
     * been fetched. Deriving the name from it rather than from a prop means
     * this can only ever listen to the channel the token authorises anyway.
     */
    void client.connection.once("connected").then(() => {
      channel = client.channels.get(`user:${client.auth.clientId}`);
      void channel.subscribe(onNudge);
    });

    return () => {
      clearTimeout(timer);
      channel?.unsubscribe();
      client.close();
    };
  }, [enabled, router]);

  return null;
}
