import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/actions/posts";
import { PostForm } from "@/components/admin/post-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Edit Post | Admin",
};

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(Number(id));
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to posts">
          <Link href="/admin/posts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Post</h1>
          <p className="text-sm text-muted-foreground">{post.title}</p>
        </div>
      </div>
      <PostForm post={post} />
    </div>
  );
}
