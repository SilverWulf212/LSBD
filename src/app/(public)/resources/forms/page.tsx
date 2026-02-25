import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FormList } from "@/components/content/form-list";
import { db } from "@/lib/db";
import { downloadableForms } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Forms Library",
  description: "Download applications, permits, and other forms required by the Louisiana State Board of Dentistry.",
};

export default async function FormsPage() {
  const allForms = await db.select().from(downloadableForms).where(eq(downloadableForms.isActive, true)).orderBy(downloadableForms.category, downloadableForms.sortOrder);

  return (
    <>
      <PageHeader title="Forms Library" description="Download the applications, permits, and forms required by the Board. Use the search and category filters to find what you need." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <FormList forms={allForms} />
      </div>
    </>
  );
}
