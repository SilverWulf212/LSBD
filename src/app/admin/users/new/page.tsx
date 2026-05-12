import React from "react";
import Link from "next/link";
import { UserForm } from "@/components/admin/user-form";
import { requireAuth } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "New user | Admin",
};

export default async function NewUserPage() {
  await requireAuth("admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to users">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New user</h1>
          <p className="text-sm text-muted-foreground">Create an admin account</p>
        </div>
      </div>
      <UserForm />
    </div>
  );
}
