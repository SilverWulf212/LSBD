// scripts/lib/seed-guard.ts
//
// Pure pre-flight check for scripts/seed.ts, which deletes every CMS table.
// No imports on purpose: the unit test loads it without a database.

const MIN_PASSWORD_LENGTH = 14;

export function assertSeedAllowed(input: {
  password: string | undefined;
  existingUsers: number;
  argv: readonly string[];
}): string {
  const { password, existingUsers, argv } = input;
  if (!password) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be set to seed the admin user.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`INITIAL_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (existingUsers > 0 && !argv.includes("--wipe")) {
    throw new Error(
      `Refusing to seed: the users table already has ${existingUsers} row(s) and seeding deletes all CMS data. Re-run with --wipe to confirm.`,
    );
  }
  return password;
}
