import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { PostForm } from "@/components/admin/post-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "New Post | Admin",
};

export default async function NewPostPage() {
  await requireCapability("cms.write");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to posts">
          <Link href="/admin/posts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Post</h1>
          <p className="text-sm text-muted-foreground">
            Create a new news or blog post
          </p>
        </div>
      </div>
      <PostForm />
    </div>
  );
}
