import type { MetadataRoute } from "next";
import { SITE_URL, NAV_ITEMS } from "@/lib/constants";
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
  const navPages: MetadataRoute.Sitemap = NAV_ITEMS.flatMap((item) => {
    const pages = [
      {
        url: `${baseUrl}${item.href}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      },
    ];
    if ("children" in item && item.children) {
      item.children.forEach((child) => {
        pages.push({
          url: `${baseUrl}${child.href}`,
          lastModified: new Date(),
          changeFrequency: "monthly" as const,
          priority: 0.7,
        });
      });
    }
    return pages;
  });

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
