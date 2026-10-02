import React from "react";
import Link from "next/link";
import type { PermitRow } from "@/lib/staff-permits";
import { NotLinked } from "@/components/admin/not-linked";

/** One rule for every office-permit firm cell: firmId !== null means the firm row exists, named or not. */
export function PermitFirm({ row }: { row: PermitRow }) {
  if (row.firmId === null) {
    return (
      <>
        Office #{row.officeId ?? "?"} <NotLinked />
      </>
    );
  }
  return (
    <Link href={`/admin/firms/${row.firmId}`} className="text-primary hover:underline">
      {row.firmName?.trim() || `Firm ${row.firmId}`}
    </Link>
  );
}
