import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStaffMember } from "@/actions/staff";
import { StaffForm } from "@/components/admin/staff-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Staff Member | Admin" };

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("cms.read");
  const { id } = await params;
  const member = await getStaffMember(Number(id));
  if (!member) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to staff">
          <Link href="/admin/staff">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Staff Member</h1>
          <p className="text-sm text-muted-foreground">{member.name}</p>
        </div>
      </div>
      <StaffForm staffMember={member} />
    </div>
  );
}
