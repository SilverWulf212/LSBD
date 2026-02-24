"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { deleteAlert } from "@/actions/alerts";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/types";

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
};

const columns: ColumnDef<Alert>[] = [
  {
    key: "title",
    header: "Title",
    sortable: true,
    render: (a) => <span className="font-medium">{a.title}</span>,
  },
  {
    key: "severity",
    header: "Severity",
    sortable: true,
    render: (a) => (
      <Badge className={cn("text-xs", severityColors[a.severity])}>
        {a.severity}
      </Badge>
    ),
  },
  {
    key: "isActive",
    header: "Active",
    render: (a) => (
      <Badge variant={a.isActive ? "default" : "secondary"}>
        {a.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "sortOrder",
    header: "Order",
    sortable: true,
  },
];

export function AlertsTable({ alerts }: { alerts: Alert[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Alert | null>(null);

  const actions: RowAction<Alert>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (a) => router.push(`/admin/alerts/${a.id}/edit`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (a) => setDeleteTarget(a),
    },
  ];

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteAlert(deleteTarget.id);
        toast.success("Alert deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete alert.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={alerts}
        columns={columns}
        actions={actions}
        searchKey="title"
        searchPlaceholder="Search alerts..."
        getRowId={(a) => a.id}
        emptyMessage="No alerts yet."
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
