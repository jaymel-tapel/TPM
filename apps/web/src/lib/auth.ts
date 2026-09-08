import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

const COOKIE = "mb_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

type Payload = { sub: string; viewAs?: string; issuedAt: number };

/**
 * Whether a token predates the password it was issued against.
 *
 * `iat` is whole seconds and the column is not, so a token minted in the same
 * second as the change would round to just before it and be thrown away. A
 * second of slack costs nothing — the window it reopens is the second the
 * administrator was already holding the new password in their hand.
 */
export function sessionOutdated(issuedAtMs: number, passwordChangedAt: Date): boolean {
  return issuedAtMs + 1000 < passwordChangedAt.getTime();
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

async function sign(payload: Omit<Payload, "issuedAt">) {
  return new SignJWT({ viewAs: payload.viewAs })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

async function writeCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function createSession(userId: string) {
  await writeCookie(await sign({ sub: userId }));
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function readToken(): Promise<Payload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: payload.sub as string,
      viewAs: payload.viewAs as string | undefined,
      issuedAt: (payload.iat ?? 0) * 1000,
    };
  } catch {
    return null;
  }
}

export type Session = {
  /** The account that actually logged in. */
  account: User;
  /** Who the app renders as — differs only via the demo role switcher. */
  user: User;
  impersonating: boolean;
};

/**
 * Resolved once per request. `user` is the effective viewer that every query
 * and permission check is written against.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const payload = await readToken();
  if (!payload) return null;

  const account = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });
  if (!account) return null;

  /*
   * A session is a signed cookie, so changing a password would not end one on
   * its own — the person stays signed in on whatever device they are already
   * on. A token issued before the password last changed is refused, which is
   * what makes a reset actually reset something.
   */
  if (sessionOutdated(payload.issuedAt, account.passwordChangedAt)) return null;

  if (payload.viewAs && payload.viewAs !== account.id) {
    const viewed = await db.query.users.findFirst({
      where: eq(users.id, payload.viewAs),
    });
    if (viewed) return { account, user: viewed, impersonating: true };
  }
  return { account, user: account, impersonating: false };
});

/**
 * Session or bust. A cookie whose user no longer exists (or whose signature no
 * longer verifies) sends the viewer back to sign in rather than to an error.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireUser(): Promise<User> {
  return (await requireSession()).user;
}

/** Demo-only: re-point the session at another seeded user. */
export async function setViewAs(userId: string | null) {
  const payload = await readToken();
  if (!payload) throw new Error("Not authenticated");
  await writeCookie(await sign({ sub: payload.sub, viewAs: userId ?? undefined }));
}

export const demoSwitcherEnabled =
  process.env.NEXT_PUBLIC_DEMO_ROLE_SWITCHER === "true";
