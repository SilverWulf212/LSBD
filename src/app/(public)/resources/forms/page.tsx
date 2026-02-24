import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FormList } from "@/components/content/form-list";
import { MOCK_FORMS } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Forms Library",
  description: "Download applications, permits, and other forms required by the Louisiana State Board of Dentistry.",
};

export default function FormsPage() {
  return (
    <>
      <PageHeader title="Forms Library" description="Download the applications, permits, and forms required by the Board. Use the search and category filters to find what you need." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <FormList forms={MOCK_FORMS} />
      </div>
    </>
  );
}
