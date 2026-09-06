import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

/**
 * Only a session that actually resolves to a user sends you home — a stale
 * cookie just gets the sign-in form, which overwrites it.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.user.role));
  return <LoginForm />;
}
