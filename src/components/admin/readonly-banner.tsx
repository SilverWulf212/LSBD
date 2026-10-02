import { Lock } from "lucide-react";
import {
  getStaffMode,
  READONLY_BANNER_TEXT,
  READONLY_BANNER_TITLE,
} from "@/lib/staff-mode";

export function ReadonlyBanner() {
  if (getStaffMode() === "live") return null;
  return (
    <div
      role="status"
      className="print:hidden mx-4 mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 lg:mx-6"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{READONLY_BANNER_TITLE}</p>
        <p>{READONLY_BANNER_TEXT}</p>
      </div>
    </div>
  );
}
