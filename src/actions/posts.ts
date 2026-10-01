"use server";

import { requireCapability } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { posts, auditLog } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { postSchema } from "@/lib/validators";
import type { Post } from "@/types";

export async function getPosts(): Promise<Post[]> {
  await requireCapability("cms.read");
  try {
    return await db.select().from(posts).orderBy(desc(posts.createdAt));
  } catch {
    return [];
  }
}

export async function getPost(id: number): Promise<Post | null> {
  await requireCapability("cms.read");
  try {
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return post ?? null;
  } catch {
    return null;
  }
}

export async function createPost(formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    content: formData.get("content") as string,
    excerpt: (formData.get("excerpt") as string) || undefined,
    featuredImage: (formData.get("featuredImage") as string) || undefined,
    status: formData.get("status") as "draft" | "published" | "archived",
  };

  const validated = postSchema.parse(raw);

  const publishedAt =
    validated.status === "published" ? new Date() : null;

  const [inserted] = await db
    .insert(posts)
    .values({
      title: validated.title,
      slug: validated.slug,
      content: validated.content,
      excerpt: validated.excerpt || null,
      featuredImage: validated.featuredImage || null,
      status: validated.status,
      publishedAt,
      authorId: Number(session.user.id),
    })
    .returning();

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "create",
    entityType: "post",
    entityId: inserted.id,
    details: { title: validated.title },
  });

  revalidatePath("/news");
  revalidatePath("/admin/posts");
  redirect("/admin/posts");
}

export async function updatePost(id: number, formData: FormData) {
  const session = await requireCapability("cms.write");
  const raw = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    content: formData.get("content") as string,
    excerpt: (formData.get("excerpt") as string) || undefined,
    featuredImage: (formData.get("featuredImage") as string) || undefined,
    status: formData.get("status") as "draft" | "published" | "archived",
  };

  const validated = postSchema.parse(raw);

  // Check if we need to set publishedAt
  const [existing] = await db
    .select({ publishedAt: posts.publishedAt, status: posts.status })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);

  let publishedAt = existing?.publishedAt ?? null;
  if (validated.status === "published" && existing?.status !== "published") {
    publishedAt = new Date();
  }

  await db
    .update(posts)
    .set({
      title: validated.title,
      slug: validated.slug,
      content: validated.content,
      excerpt: validated.excerpt || null,
      featuredImage: validated.featuredImage || null,
      status: validated.status,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "update",
    entityType: "post",
    entityId: id,
    details: { title: validated.title },
  });

  revalidatePath("/news");
  revalidatePath(`/news/${validated.slug}`);
  revalidatePath("/admin/posts");
  redirect("/admin/posts");
}

export async function deletePost(id: number) {
  const session = await requireCapability("cms.write");

  const [post] = await db
    .select({ title: posts.title })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);

  await db.delete(posts).where(eq(posts.id, id));

  await db.insert(auditLog).values({
    userId: Number(session.user.id),
    action: "delete",
    entityType: "post",
    entityId: id,
    details: { title: post?.title },
  });

  revalidatePath("/news");
  revalidatePath("/admin/posts");
}

export async function getPostsCount(): Promise<number> {
  await requireCapability("cms.read");
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.status, "published"));
    return result?.count ?? 0;
  } catch {
    return 0;
  }
}
