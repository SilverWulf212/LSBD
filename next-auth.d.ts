import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";
import type { LsbdRole } from "@/lib/auth-roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: LsbdRole;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: LsbdRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: LsbdRole;
    checkedAt?: number;
    signedInAt?: number;
  }
}
