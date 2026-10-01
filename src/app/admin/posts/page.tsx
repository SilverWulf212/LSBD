import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { getPosts } from "@/actions/posts";
import { PostsTable } from "./posts-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = {
  title: "Posts | Admin",
};

export default async function PostsPage() {
  await requireCapability("cms.read");
  const posts = await getPosts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Manage news and blog posts
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Post
          </Link>
        </Button>
      </div>

      <PostsTable posts={posts} />
    </div>
  );
}
