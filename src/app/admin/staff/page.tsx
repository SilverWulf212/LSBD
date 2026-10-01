import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { getStaff } from "@/actions/staff";
import { StaffTable } from "./staff-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Staff | Admin" };

export default async function StaffPage() {
  await requireCapability("cms.read");
  const staff = await getStaff();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff Directory</h1>
          <p className="text-sm text-muted-foreground">
            Manage staff member listings
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/staff/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Staff Member
          </Link>
        </Button>
      </div>
      <StaffTable staff={staff} />
    </div>
  );
}
