import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { LsbdRole } from "@/lib/auth-roles";
import { can, type Capability } from "@/lib/auth-capabilities";

type AuthedSession = Session & { user: NonNullable<Session["user"]> };

export async function requireAuth(
  roles?: LsbdRole | LsbdRole[]
): Promise<AuthedSession> {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(session.user.role)) redirect("/admin/403");
  }

  return session as AuthedSession;
}

/** The session if signed in and the role holds `cap`; otherwise null. */
export async function getSessionWith(
  cap: Capability
): Promise<AuthedSession | null> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, cap)) return null;
  return session as AuthedSession;
}

/** Page/action gate: login redirect with no session, /admin/403 without `cap`. */
export async function requireCapability(
  cap: Capability
): Promise<AuthedSession> {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (!can(session.user.role, cap)) redirect("/admin/403");
  return session as AuthedSession;
}
