import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PostCard } from "@/components/content/post-card";
import { MOCK_POSTS } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "News & Updates",
  description: "Latest news, announcements, and updates from the Louisiana State Board of Dentistry.",
};

export default function NewsPage() {
  const publishedPosts = MOCK_POSTS.filter((p) => p.status === "published").sort(
    (a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime()
  );

  return (
    <>
      <PageHeader title="News & Updates" description="Stay informed with the latest news, rule changes, and announcements from the Board." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {publishedPosts.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-12">No news articles published yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedPosts.map((post) => (
              <PostCard
                key={post.id}
                title={post.title}
                slug={post.slug}
                excerpt={post.excerpt}
                publishedAt={post.publishedAt}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
