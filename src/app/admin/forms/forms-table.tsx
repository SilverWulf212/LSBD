"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { FORM_CATEGORIES } from "@/lib/constants";
import { deleteForm } from "@/actions/forms";
import { toast } from "sonner";
import { Pencil, Trash2, ExternalLink, FileText } from "lucide-react";
import type { DownloadableForm } from "@/types";

const columns: ColumnDef<DownloadableForm>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (f) => (
      <div className="flex items-center gap-2">
        {f.isExternal ? (
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        )}
        <span className="font-medium">{f.name}</span>
      </div>
    ),
  },
  {
    key: "category",
    header: "Category",
    sortable: true,
    render: (f) => {
      const cat = FORM_CATEGORIES.find((c) => c.key === f.category);
      return cat?.label ?? f.category;
    },
  },
  {
    key: "isActive",
    header: "Status",
    render: (f) => (
      <Badge variant={f.isActive ? "default" : "secondary"}>
        {f.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "sortOrder",
    header: "Order",
    sortable: true,
  },
];

export function FormsTable({ forms }: { forms: DownloadableForm[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<DownloadableForm | null>(null);

  const actions: RowAction<DownloadableForm>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (f) => router.push(`/admin/forms/${f.id}/edit`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (f) => setDeleteTarget(f),
    },
  ];

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteForm(deleteTarget.id);
        toast.success("Form deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete form.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={forms}
        columns={columns}
        actions={actions}
        searchKey="name"
        searchPlaceholder="Search forms..."
        getRowId={(f) => f.id}
        emptyMessage="No forms yet."
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
