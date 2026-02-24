import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  if (!email || !newPassword) {
    console.error("Usage: npx tsx scripts/reset-password.ts <email> <new-password>");
    process.exit(1);
  }
  const passwordHash = await hash(newPassword, 12);
  const [updated] = await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.email, email)).returning();
  if (!updated) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`Password reset for ${updated.name} (${updated.email})`);
}

resetPassword().catch(console.error);
