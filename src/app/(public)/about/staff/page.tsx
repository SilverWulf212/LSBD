import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StaffDirectory } from "@/components/content/staff-directory";
import { db } from "@/lib/db";
import { staffMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CONTACT } from "@/lib/constants";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Staff Directory",
  description: "Contact information for Louisiana State Board of Dentistry staff members.",
};

export default async function StaffPage() {
  const staff = await db.select().from(staffMembers).where(eq(staffMembers.isActive, true)).orderBy(staffMembers.sortOrder);

  return (
    <>
      <PageHeader title="Staff Directory" description="Contact the Board staff for assistance with licensing, complaints, meetings, and other inquiries." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <StaffDirectory staff={staff} />
        <div className="mt-10 bg-[#CAF0F8]/30 rounded-xl p-6 text-sm text-[#495057] space-y-2">
          <p><strong>Office Hours:</strong> Monday through Friday, 8:00 AM to 4:30 PM (Central Time). Closed on state holidays.</p>
          <p><strong>Phone:</strong> <a href={`tel:${CONTACT.phone.replace(/-/g, "")}`} className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">{CONTACT.phone}</a></p>
          <p><strong>Physical Address:</strong> {CONTACT.physicalAddress}</p>
          <p><strong>Mailing Address:</strong> {CONTACT.mailingAddress}</p>
        </div>
      </div>
    </>
  );
}
