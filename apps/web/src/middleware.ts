import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate only — presence of the cookie, not its validity. Every page and
 * action still resolves the real session server-side.
 *
 * /login is deliberately never redirected away from here: a cookie that no
 * longer resolves to a user would otherwise bounce between the two forever.
 * The login page decides for itself whether an already-signed-in viewer should
 * be sent home.
 */
export function middleware(request: NextRequest) {
  const signedIn = request.cookies.has("mb_session");
  const { pathname } = request.nextUrl;

  // The design system page is static examples only — no user data on it.
  if (!signedIn && pathname !== "/login" && !pathname.startsWith("/design")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  /*
   * Pages only. Anything with a file extension is a static asset and is left
   * alone — the brand mark lives in `public/`, and the image optimiser fetches
   * it over HTTP without a cookie, so gating it turned the logo into a
   * redirect to /login. The login page needs it while signed out anyway.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
