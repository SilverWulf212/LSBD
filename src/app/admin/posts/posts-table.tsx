"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type ColumnDef, type RowAction } from "@/components/admin/data-table";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { deletePost } from "@/actions/posts";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { Post } from "@/types";

const statusColors: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
};

const columns: ColumnDef<Post>[] = [
  {
    key: "title",
    header: "Title",
    sortable: true,
    render: (post) => (
      <span className="font-medium max-w-[300px] truncate block">
        {post.title}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (post) => (
      <Badge variant={statusColors[post.status] ?? "secondary"}>
        {post.status}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    sortable: true,
    render: (post) =>
      post.createdAt
        ? new Date(post.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
  },
  {
    key: "publishedAt",
    header: "Published",
    sortable: true,
    render: (post) =>
      post.publishedAt
        ? new Date(post.publishedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
  },
];

export function PostsTable({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  const actions: RowAction<Post>[] = [
    {
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (post) => router.push(`/admin/posts/${post.id}/edit`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (post) => setDeleteTarget(post),
    },
  ];

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deletePost(deleteTarget.id);
        toast.success("Post deleted successfully.");
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete post.");
      }
    });
  }

  return (
    <>
      <DataTable
        data={posts}
        columns={columns}
        actions={actions}
        searchKey="title"
        searchPlaceholder="Search posts..."
        getRowId={(p) => p.id}
        emptyMessage="No posts yet. Create your first post."
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
