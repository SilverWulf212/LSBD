import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/layout/page-header";
import { PostCard } from "@/components/content/post-card";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "News & Updates",
  description: "Latest news, announcements, and updates from the Louisiana State Board of Dentistry.",
};

export default async function NewsPage() {
  const publishedPosts = await db.select().from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedAt));

  return (
    <>
      <PageHeader title="News & Updates" description="Stay informed with the latest news, rule changes, and announcements from the Board." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {publishedPosts.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-12">No news articles published yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {publishedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    title={post.title}
                    slug={post.slug}
                    excerpt={post.excerpt}
                    publishedAt={post.publishedAt?.toISOString() ?? null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Decorative sidebar */}
          <div className="hidden lg:block space-y-6">
            <Image
              src="/images/people/hygienist-teal.png"
              alt="Dental hygienist in teal scrubs smiling"
              width={400}
              height={500}
              className="rounded-lg"
            />
            <div className="bg-[#CAF0F8]/30 rounded-xl p-5">
              <h2 className="font-[family-name:var(--font-oswald)] text-sm font-bold text-[#005f8f] uppercase tracking-wide mb-2">
                RSS Feed
              </h2>
              <p className="text-xs text-[#495057] mb-3">
                Subscribe to our news feed to get the latest updates.
              </p>
              <a
                href="/news/feed.xml"
                className="inline-flex items-center text-xs font-medium text-[#0077B6] hover:text-[#005f8f] transition-colors"
              >
                Subscribe via RSS
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
