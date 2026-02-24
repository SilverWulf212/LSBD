import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { PostContent } from "@/components/content/post-content";
import { MOCK_POSTS } from "@/lib/mock-data";
import { CalendarDays, ArrowLeft } from "lucide-react";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = MOCK_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: post.title,
    description: post.excerpt || `Read ${post.title} from the Louisiana State Board of Dentistry.`,
  };
}

export async function generateStaticParams() {
  return MOCK_POSTS.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = MOCK_POSTS.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <PageHeader title={post.title}>
        {post.publishedAt && (
          <div className="flex items-center gap-2 text-sm text-[#495057]">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            <time dateTime={new Date(post.publishedAt).toISOString()}>
              {format(new Date(post.publishedAt), "MMMM d, yyyy")}
            </time>
          </div>
        )}
      </PageHeader>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <PostContent html={post.content} />
        <div className="mt-10 pt-6 border-t">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to all news
          </Link>
        </div>
      </div>
    </>
  );
}
