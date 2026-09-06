import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";

/** The system already knows what each role needs — no landing page to choose from. */
export default async function Root() {
  const session = await getSession();
  redirect(session ? homeFor(session.user.role) : "/login");
}
