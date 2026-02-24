import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SITE_NAME } from "@/lib/constants";

export async function GET() {
  const siteUrl = process.env.AUTH_URL || "https://lsbd.org";
  let publishedPosts: Array<{
    title: string;
    slug: string;
    excerpt: string | null;
    publishedAt: Date | null;
  }> = [];

  try {
    publishedPosts = await db
      .select({
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.publishedAt))
      .limit(20);
  } catch {
    /* DB not connected locally */
  }

  const items = publishedPosts
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}/news/${post.slug}</link>
      <description><![CDATA[${post.excerpt || ""}]]></description>
      <pubDate>${post.publishedAt ? new Date(post.publishedAt).toUTCString() : ""}</pubDate>
      <guid isPermaLink="true">${siteUrl}/news/${post.slug}</guid>
    </item>`
    )
    .join("");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} - News</title>
    <link>${siteUrl}/news</link>
    <description>Latest news and announcements from the ${SITE_NAME}</description>
    <language>en-us</language>
    <atom:link href="${siteUrl}/news/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
