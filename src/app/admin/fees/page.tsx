import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import { getFees } from "@/actions/fees";
import { FeesManager } from "./fees-manager";

export const metadata = { title: "Fees | Admin" };

export default async function FeesPage() {
  await requireCapability("cms.read");
  const fees = await getFees();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fee Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Manage fees by category. Edit directly in the table.
        </p>
      </div>
      <FeesManager initialFees={fees} />
    </div>
  );
}
