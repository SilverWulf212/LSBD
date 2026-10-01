"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { deleteUser } from "@/actions/users";
import { ROLE_LABELS } from "@/lib/auth-roles";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { SafeUser } from "@/types";

const columns: ColumnDef<SafeUser>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (u) => <span className="font-medium">{u.name}</span>,
  },
  {
    key: "email",
    header: "Email",
    sortable: true,
    render: (u) => <span className="text-muted-foreground">{u.email}</span>,
  },
  {
    key: "role",
    header: "Role",
    sortable: true,
    render: (u) => <Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge>,
  },
  {
    key: "createdAt",
    header: "Created",
    sortable: true,
    render: (u) =>
      u.createdAt
        ? new Date(u.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
  },
];

export function UsersTable({
  users,
  currentUserId,
}: {
  users: SafeUser[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<SafeUser | null>(null);

  const actions: RowAction<SafeUser>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (u) => router.push(`/admin/users/${u.id}/edit`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (u) => {
        if (u.id === currentUserId) {
          toast.error("You cannot delete your own account.");
          return;
        }
        setDeleteTarget(u);
      },
    },
  ];

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteUser(deleteTarget.id);
        toast.success("User deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete user.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={users}
        columns={columns}
        actions={actions}
        searchKey="email"
        searchPlaceholder="Search users..."
        getRowId={(u) => u.id}
        emptyMessage="No users yet."
      />
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        itemName={deleteTarget?.email ?? ""}
        isPending={isPending}
      />
    </>
  );
}
