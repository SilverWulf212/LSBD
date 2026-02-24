"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { deleteBoardMember } from "@/actions/board-members";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { BoardMember } from "@/types";

const roleLabels: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  secretary_treasurer: "Secretary/Treasurer",
  member: "Member",
  hygienist_representative: "Hygienist Rep.",
  consumer_member: "Consumer",
};

const columns: ColumnDef<BoardMember>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (m) => (
      <span className="font-medium">
        {m.honorific ? `${m.honorific} ` : ""}
        {m.name}
        {m.credential ? `, ${m.credential}` : ""}
      </span>
    ),
  },
  {
    key: "role",
    header: "Role",
    sortable: true,
    render: (m) => roleLabels[m.role] ?? m.role,
  },
  {
    key: "district",
    header: "District",
    render: (m) => m.district || "—",
  },
  {
    key: "isActive",
    header: "Status",
    render: (m) => (
      <Badge variant={m.isActive ? "default" : "secondary"}>
        {m.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "sortOrder",
    header: "Order",
    sortable: true,
  },
];

export function BoardTable({ members }: { members: BoardMember[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<BoardMember | null>(null);

  const actions: RowAction<BoardMember>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (m) => router.push(`/admin/board/${m.id}/edit`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (m) => setDeleteTarget(m),
    },
  ];

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteBoardMember(deleteTarget.id);
        toast.success("Board member deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete board member.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={members}
        columns={columns}
        actions={actions}
        searchKey="name"
        searchPlaceholder="Search members..."
        getRowId={(m) => m.id}
        emptyMessage="No board members yet."
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
