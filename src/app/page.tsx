import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSection } from "@/components/content/hero-section";
import { AlertBannerList } from "@/components/content/alert-banner";
import { FeatureCards } from "@/components/content/feature-cards";
import { PostCard } from "@/components/content/post-card";
import { MeetingList } from "@/components/content/meeting-list";
import { MOCK_ALERTS, MOCK_POSTS, MOCK_MEETINGS } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Louisiana State Board of Dentistry",
  description:
    "Protecting the public by regulating the professions of dentistry and dental hygiene in Louisiana since 1894.",
};

export default function HomePage() {
  const activeAlerts = MOCK_ALERTS.filter((a) => a.isActive);
  const recentPosts = MOCK_POSTS.slice(0, 3);
  const upcomingMeetings = MOCK_MEETINGS.filter(
    (m) => new Date(m.meetingDate) >= new Date()
  ).slice(0, 3);

  return (
    <>
      <SiteHeader />
      <main id="main-content" role="main" tabIndex={-1} className="focus:outline-none">
        {/* Hero */}
        <HeroSection />

        {/* Alerts */}
        {activeAlerts.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
            <AlertBannerList alerts={activeAlerts} />
          </section>
        )}

        {/* Feature Cards */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <FeatureCards />
        </section>

        {/* Professionals Section */}
        <section className="py-16 bg-[#CAF0F8]/30">
          <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <Image
                src="/images/people/professional-female-wide.png"
                alt="Dental professional smiling"
                width={1024}
                height={658}
                className="rounded-lg"
              />
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-[#495057] uppercase tracking-wide mb-4">
                Protecting Louisiana&apos;s Dental Health Since 1894
              </h2>
              <p className="text-lg text-[#495057] leading-relaxed mb-6">
                The Louisiana State Board of Dentistry regulates over 4,500 dental professionals
                across the state, ensuring the highest standards of care for every patient.
                Whether you&apos;re a licensed practitioner, an aspiring dental professional,
                or a member of the public, we&apos;re here to serve you.
              </p>
              <div className="flex gap-4">
                <Link
                  href="/about"
                  className="inline-flex items-center px-6 py-3 bg-[#0077B6] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide rounded-md hover:bg-[#005f8f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 min-h-[44px]"
                >
                  Learn About the Board
                </Link>
              </div>
            </div>
          </div>
        </section>

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
