import React from "react";
import Link from "next/link";
import { StaffForm } from "@/components/admin/staff-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Staff Member | Admin" };

export default function NewStaffPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to staff">
          <Link href="/admin/staff">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Staff Member</h1>
          <p className="text-sm text-muted-foreground">Add a new staff member</p>
        </div>
      </div>
      <StaffForm />
    </div>
  );
}
