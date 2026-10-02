import React from "react";
import Link from "next/link";
import type { PermitRow } from "@/lib/staff-permits";
import { NotLinked } from "@/components/admin/not-linked";

/** One rule for every permit list: holderKey !== null means the person row exists. */
export function PermitHolder({ row, canOpenLicensee }: { row: PermitRow; canOpenLicensee: boolean }) {
  if (row.holderKey === null) {
    return (
      <>
        {row.dentistId !== null ? `Dentist id ${row.dentistId}` : "no holder recorded"} <NotLinked />
      </>
    );
  }
  const name = row.holderName?.trim() || `Key ${row.holderKey}`;
  return canOpenLicensee ? (
    <Link href={`/admin/licensees/${row.holderKey}`} className="font-medium text-primary hover:underline">
      {name}
    </Link>
  ) : (
    <>{name}</>
  );
}
