"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { deleteStaff } from "@/actions/staff";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { StaffMember } from "@/types";

const columns: ColumnDef<StaffMember>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (s) => <span className="font-medium">{s.name}</span>,
  },
  {
    key: "title",
    header: "Title",
    sortable: true,
  },
  {
    key: "email",
    header: "Email",
    render: (s) => (
      <a
        href={`mailto:${s.email}`}
        className="text-primary hover:underline"
      >
        {s.email}
      </a>
    ),
  },
  {
    key: "phone",
    header: "Phone",
    render: (s) => s.phone || "—",
  },
  {
    key: "isActive",
    header: "Status",
    render: (s) => (
      <Badge variant={s.isActive ? "default" : "secondary"}>
        {s.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "sortOrder",
    header: "Order",
    sortable: true,
  },
];

export function StaffTable({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const actions: RowAction<StaffMember>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (s) => router.push(`/admin/staff/${s.id}/edit`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (s) => setDeleteTarget(s),
    },
  ];

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteStaff(deleteTarget.id);
        toast.success("Staff member deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete staff member.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={staff}
        columns={columns}
        actions={actions}
        searchKey="name"
        searchPlaceholder="Search staff..."
        getRowId={(s) => s.id}
        emptyMessage="No staff members yet."
      />
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        itemName={deleteTarget?.name ?? ""}
        isPending={isPending}
      />
    </>
  );
}
