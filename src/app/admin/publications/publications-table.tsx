"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { deletePublication } from "@/actions/publications";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import type { Publication } from "@/types";

const columns: ColumnDef<Publication>[] = [
  {
    key: "title",
    header: "Title",
    sortable: true,
    render: (p) => <span className="font-medium">{p.title}</span>,
  },
  {
    key: "year",
    header: "Year",
    sortable: true,
  },
  {
    key: "fileSizeBytes",
    header: "Size",
    render: (p) =>
      p.fileSizeBytes ? formatFileSize(p.fileSizeBytes) : "—",
  },
  {
    key: "isPublished",
    header: "Status",
    render: (p) => (
      <Badge variant={p.isPublished ? "default" : "secondary"}>
        {p.isPublished ? "Published" : "Draft"}
      </Badge>
    ),
  },
];

export function PublicationsTable({ publications }: { publications: Publication[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Publication | null>(null);

  const actions: RowAction<Publication>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (p) => router.push(`/admin/publications/${p.id}/edit`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (p) => setDeleteTarget(p),
    },
  ];

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deletePublication(deleteTarget.id);
        toast.success("Publication deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete publication.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={publications}
        columns={columns}
        actions={actions}
        searchKey="title"
        searchPlaceholder="Search publications..."
        getRowId={(p) => p.id}
        emptyMessage="No publications yet."
      />
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        itemName={deleteTarget?.title ?? ""}
        isPending={isPending}
      />
    </>
  );
}
