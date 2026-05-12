import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { LsbdRole } from "@/lib/auth-roles";

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
