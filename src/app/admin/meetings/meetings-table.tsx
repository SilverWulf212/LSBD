"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { MEETING_TYPES } from "@/lib/constants";
import { deleteMeeting } from "@/actions/meetings";
import { toast } from "sonner";
import { Pencil, Trash2, FileText } from "lucide-react";
import type { MeetingWithDocuments } from "@/types";

const columns: ColumnDef<MeetingWithDocuments>[] = [
  {
    key: "title",
    header: "Title",
    sortable: true,
    render: (m) => <span className="font-medium">{m.title}</span>,
  },
  {
    key: "meetingDate",
    header: "Date",
    sortable: true,
    render: (m) =>
      new Date(m.meetingDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    accessorFn: (m) => new Date(m.meetingDate).toISOString(),
  },
  {
    key: "meetingType",
    header: "Type",
    render: (m) => {
      const type = MEETING_TYPES.find((t) => t.key === m.meetingType);
      return type?.label ?? m.meetingType;
    },
  },
  {
    key: "documents",
    header: "Documents",
    render: (m) => (
      <div className="flex items-center gap-1">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm">{m.documents.length}</span>
      </div>
    ),
  },
  {
    key: "isPublished",
    header: "Status",
    render: (m) => (
      <Badge variant={m.isPublished ? "default" : "secondary"}>
        {m.isPublished ? "Published" : "Draft"}
      </Badge>
    ),
  },
];

export function MeetingsTable({ meetings }: { meetings: MeetingWithDocuments[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<MeetingWithDocuments | null>(null);

  const actions: RowAction<MeetingWithDocuments>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (m) => router.push(`/admin/meetings/${m.id}/edit`),
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
        await deleteMeeting(deleteTarget.id);
        toast.success("Meeting deleted.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete meeting.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={meetings}
        columns={columns}
        actions={actions}
        searchKey="title"
        searchPlaceholder="Search meetings..."
        getRowId={(m) => m.id}
        emptyMessage="No meetings yet."
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
