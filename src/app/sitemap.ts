import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { allNavPages } from "@/lib/nav";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
  ];

  // Nav-based pages
  const navPages: MetadataRoute.Sitemap = allNavPages().map((page) => ({
    url: `${baseUrl}${page.href}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    // Section landing pages (one path segment) rank above the pages under them.
    priority: page.href.split("/").length === 2 ? 0.8 : 0.7,
  }));

  // Blog posts from database
  const publishedPosts = await db.select().from(posts).where(eq(posts.status, "published"));

  const postPages: MetadataRoute.Sitemap = publishedPosts.map((post) => ({
    url: `${baseUrl}/news/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...navPages, ...postPages];
}
