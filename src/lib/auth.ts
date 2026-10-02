import NextAuth, { type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { clientIp } from "@/lib/client-ip";
import { verifyCredentials } from "@/lib/login-limiter";
import { pgAttemptStore } from "@/lib/login-attempts-store";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const result = await verifyCredentials(
          { email: credentials?.email, password: credentials?.password, ip: clientIp(request.headers) },
          {
            store: pgAttemptStore,
            compare,
            async findUser(email) {
              const [user] = await db
                .select({
                  id: users.id,
                  email: users.email,
                  name: users.name,
                  role: users.role,
                  passwordHash: users.passwordHash,
                })
                .from(users)
                .where(sql`lower(${users.email}) = ${email}`)
                .limit(1);
              return user;
            },
          }
        );
        // role comes from users.role (a typed enum column); the limiter treats it as a string
        return result as User | null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
      const isLoginPage = request.nextUrl.pathname === "/admin/login";
      if (isAdminRoute && !isLoginPage && !auth?.user) return false;
      return true;
    },
  },
});
