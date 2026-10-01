import React from "react";
import Link from "next/link";
import { getUsers } from "@/actions/users";
import { requireCapability } from "@/lib/auth-utils";
import { UsersTable } from "./users-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = {
  title: "Users | Admin",
};

export default async function UsersPage() {
  const session = await requireCapability("users.manage");
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage admin accounts and roles
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New user
          </Link>
        </Button>
      </div>

      <UsersTable users={users} currentUserId={Number(session.user.id)} />
    </div>
  );
}
