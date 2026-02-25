import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroCarousel } from "@/components/content/hero-carousel";
import { AlertBannerList } from "@/components/content/alert-banner";
import { FeatureCards } from "@/components/content/feature-cards";
import { AnimatedStats } from "@/components/content/animated-stats";
import { ParallaxMission } from "@/components/content/parallax-mission";
import { PostCard } from "@/components/content/post-card";
import { MeetingList } from "@/components/content/meeting-list";
import { db } from "@/lib/db";
import { alerts, posts, meetings } from "@/lib/db/schema";
import { eq, desc, gte } from "drizzle-orm";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Louisiana State Board of Dentistry",
  description:
    "Protecting the public by regulating the professions of dentistry and dental hygiene in Louisiana since 1894. Apply for a license, renew, verify professionals, and access resources.",
};

export default async function HomePage() {
  const [activeAlerts, recentPosts, upcomingMeetings] = await Promise.all([
    db.select().from(alerts).where(eq(alerts.isActive, true)).orderBy(alerts.sortOrder),
    db.select().from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedAt)).limit(3),
    db.query.meetings.findMany({
      where: (meetings, { eq, gte, and }) => and(eq(meetings.isPublished, true), gte(meetings.meetingDate, new Date())),
      orderBy: (meetings, { asc }) => [asc(meetings.meetingDate)],
      limit: 3,
      with: { documents: true },
    }),
  ]);

  return (
    <>
      <SiteHeader />
      <main id="main-content" role="main" tabIndex={-1} className="focus:outline-none">
        {/* Hero Carousel */}
        <HeroCarousel />

        {/* Alerts */}
        {activeAlerts.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
            <AlertBannerList alerts={activeAlerts} />
          </section>
        )}

        {/* Feature Cards */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <FeatureCards />
        </section>

        {/* Animated Stats — responsive element #1 */}
        <AnimatedStats />

        {/* Parallax Mission — responsive element #2 */}
        <ParallaxMission />

        {/* Latest News + Upcoming Meetings */}
        <section className="bg-gray-50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
              {/* News */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide">
                    Latest News
                  </h2>
                  <Link
                    href="/news"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
                  >
                    View all news
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recentPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      title={post.title}
                      slug={post.slug}
                      excerpt={post.excerpt}
                      publishedAt={post.publishedAt}
                    />
                  ))}
                </div>
              </div>

              {/* Upcoming Meetings */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide">
                    Upcoming Meetings
                  </h2>
                  <Link
                    href="/resources/meetings"
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
                  >
                    All meetings
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <MeetingList meetings={upcomingMeetings} />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
