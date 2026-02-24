import { db } from "@/lib/db";
import { posts, pageSections, meetings } from "@/lib/db/schema";
import { or, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const searchTerm = `%${query}%`;
  try {
    const [postResults, pageResults, meetingResults] = await Promise.all([
      db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
        })
        .from(posts)
        .where(
          or(ilike(posts.title, searchTerm), ilike(posts.content, searchTerm))
        )
        .limit(5),
      db
        .select({
          id: pageSections.id,
          pageSlug: pageSections.pageSlug,
          title: pageSections.title,
        })
        .from(pageSections)
        .where(
          or(
            ilike(pageSections.title, searchTerm),
            ilike(pageSections.content, searchTerm)
          )
        )
        .limit(5),
      db
        .select({
          id: meetings.id,
          title: meetings.title,
          meetingDate: meetings.meetingDate,
        })
        .from(meetings)
        .where(ilike(meetings.title, searchTerm))
        .limit(5),
    ]);
    const results = [
      ...postResults.map((p) => ({
        type: "post" as const,
        title: p.title,
        url: `/news/${p.slug}`,
        excerpt: p.excerpt || "",
      })),
      ...pageResults.map((p) => ({
        type: "page" as const,
        title: p.title || p.pageSlug,
        url: `/${p.pageSlug}`,
        excerpt: "",
      })),
      ...meetingResults.map((m) => ({
        type: "meeting" as const,
        title: m.title,
        url: "/resources/meetings",
        excerpt: "",
      })),
    ];
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
