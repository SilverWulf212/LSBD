"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { createPost, updatePost } from "@/actions/posts";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { PdfUpload } from "@/components/admin/pdf-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Post } from "@/types";
import type { z } from "zod";

type PostFormValues = z.infer<typeof postSchema>;

interface PostFormProps {
  post?: Post | null;
}

export function PostForm({ post }: PostFormProps) {
  const [isPending, startTransition] = useTransition();
  const [autoSlug, setAutoSlug] = useState(!post);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: post?.title ?? "",
      slug: post?.slug ?? "",
      content: post?.content ?? "",
      excerpt: post?.excerpt ?? "",
      featuredImage: post?.featuredImage ?? "",
      status: post?.status ?? "draft",
    },
  });

  const watchTitle = form.watch("title");
  const watchSlug = form.watch("slug");
  const watchStatus = form.watch("status");

  useEffect(() => {
    if (autoSlug && watchTitle) {
      form.setValue("slug", slugify(watchTitle), { shouldValidate: true });
    }
  }, [watchTitle, autoSlug, form]);

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAutoSlug(false);
    form.setValue("slug", e.target.value, { shouldValidate: true });
  }

  function onSubmit(values: PostFormValues) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("title", values.title);
        formData.set("slug", values.slug);
        formData.set("content", values.content);
        formData.set("excerpt", values.excerpt ?? "");
        formData.set("featuredImage", values.featuredImage ?? "");
        formData.set("status", values.status);

        if (post) {
          await updatePost(post.id, formData);
        } else {
          await createPost(formData);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save post."
        );
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Post Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter post title"
                          aria-required="true"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Slug
                        {autoSlug && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            (auto-generated from title)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="post-url-slug"
                          aria-required="true"
                          {...field}
                          onChange={handleSlugChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief summary of the post"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Content</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          content={field.value}
                          onChange={field.onChange}
                          placeholder="Write your post content..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={isPending} className="flex-1">
                    {isPending ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Saving...
                      </>
                    ) : post ? (
                      "Update Post"
                    ) : (
                      "Create Post"
                    )}
                  </Button>
                  {post && watchStatus === "published" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      asChild
                      aria-label="Preview post in new tab"
                    >
                      <a
                        href={`/news/${watchSlug}?preview=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Featured Image</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="featuredImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Featured Image</FormLabel>
                      <FormControl>
                        <div>
                          {field.value ? (
                            <div className="space-y-3">
                              <img
                                src={field.value}
                                alt="Featured image preview"
                                className="w-full rounded-md border object-cover aspect-video"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => field.onChange("")}
                                className="w-full"
                              >
                                Remove Image
                              </Button>
                            </div>
                          ) : (
                            <PdfUpload
                              accept=".jpg,.jpeg,.png,.webp"
                              folder="images"
                              label="Upload featured image"
                              onUpload={(result) => field.onChange(result.url)}
                              onRemove={() => field.onChange("")}
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
