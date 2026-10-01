import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/actions/users";
import { UserForm } from "@/components/admin/user-form";
import { requireCapability } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Edit user | Admin",
};

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("users.manage");
  const { id } = await params;
  const user = await getUser(Number(id));
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to users">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit user</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <UserForm user={user} />
    </div>
  );
}
