// Small pieces shared by the staff list pages.

export const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Trimmed text, or null when the value is null or blank. */
export const trim = (v: string | null): string | null => (v === null ? null : v.trim() || null);
