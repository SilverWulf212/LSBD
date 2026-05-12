export const LSBD_ROLES = [
  "admin",
  "staff",
  "discipline",
  "finance",
  "inspector",
  "board",
] as const;

export type LsbdRole = (typeof LSBD_ROLES)[number];

export const ROLE_LABELS: Record<LsbdRole, string> = {
  admin: "Administrator",
  staff: "Staff",
  discipline: "Discipline / Complaints",
  finance: "Finance",
  inspector: "Inspector",
  board: "Board (read-only)",
};
