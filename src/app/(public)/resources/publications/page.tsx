import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PdfLink } from "@/components/shared/pdf-link";
import { Newspaper } from "lucide-react";
import { db } from "@/lib/db";
import { publications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Publications",
  description: "The Bulletin newsletter archive and other publications from the Louisiana State Board of Dentistry.",
};

export default async function PublicationsPage() {
  const pubs = await db.select().from(publications).where(eq(publications.isPublished, true)).orderBy(desc(publications.year));

  const grouped = pubs.reduce<Record<number, typeof pubs>>((acc, pub) => {
    if (!acc[pub.year]) acc[pub.year] = [];
    acc[pub.year].push(pub);
    return acc;
  }, {});

  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

  return (
    <>
      <PageHeader title="Publications" description="Archive of The Bulletin, the official newsletter of the Louisiana State Board of Dentistry." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-lg bg-[#CAF0F8] p-3"><Newspaper className="h-6 w-6 text-[#0077B6]" aria-hidden="true" /></div>
          <div>
            <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide">The Bulletin</h2>
            <p className="text-sm text-[#495057]">The official newsletter of the Louisiana State Board of Dentistry, published quarterly.</p>
          </div>
        </div>
        <div className="space-y-8">
          {years.map((year) => (
            <section key={year}>
              <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-[#005f8f] uppercase tracking-wide mb-4 border-b border-[#CAF0F8] pb-2">{year}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {grouped[year].map((pub) => (
                  <Card key={pub.id}>
                    <CardContent className="pt-6">
                      <h4 className="font-semibold text-sm text-[#005f8f] mb-1">{pub.title}</h4>
                      {pub.description && <p className="text-xs text-gray-500 mb-3">{pub.description}</p>}
                      <PdfLink href={pub.blobUrl} fileSize={pub.fileSizeBytes || undefined} className="text-sm font-medium">Download PDF</PdfLink>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
