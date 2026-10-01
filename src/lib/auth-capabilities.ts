import type { LsbdRole } from "./auth-roles";

export const CAPABILITIES = [
  "cms.read",
  "cms.write",
  "users.manage",
  "sync.view",
  "settings.manage",
  "licensees.read",
  "permits.read",
  "discipline.read",
  "pii.read",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

// Interim map until the board confirms which roles need what.
export const ROLE_CAPABILITIES: Record<LsbdRole, readonly Capability[]> = {
  admin: CAPABILITIES,
  staff: ["cms.read", "cms.write", "licensees.read", "permits.read", "pii.read"],
  discipline: ["cms.read", "licensees.read", "permits.read", "discipline.read"],
  finance: ["cms.read", "licensees.read", "permits.read"],
  inspector: ["cms.read", "licensees.read", "permits.read"],
  board: ["cms.read", "licensees.read", "permits.read"],
};

export function can(
  role: LsbdRole | null | undefined,
  cap: Capability
): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}
