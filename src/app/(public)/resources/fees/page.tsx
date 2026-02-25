import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FeeTable } from "@/components/content/fee-table";
import { db } from "@/lib/db";
import { fees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Fee Schedule",
  description: "Complete schedule of fees for dental and dental hygiene licensure, renewal, permits, and other Board services.",
};

export default async function FeesPage() {
  const allFees = await db.select().from(fees).where(eq(fees.isActive, true)).orderBy(fees.category, fees.sortOrder);
  const dentistFees = allFees.filter(f => f.category === "dentist");
  const hygienistFees = allFees.filter(f => f.category === "hygienist");
  const miscFees = allFees.filter(f => f.category === "miscellaneous");

  return (
    <>
      <PageHeader title="Fee Schedule" description="All fees are established by the Board in accordance with the Dental Practice Act. Fees are subject to change." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        <FeeTable caption="Dentist Fees" fees={dentistFees} />
        <FeeTable caption="Dental Hygienist Fees" fees={hygienistFees} />
        <FeeTable caption="Miscellaneous Fees" fees={miscFees} />
        <div className="bg-[#CAF0F8]/30 rounded-xl p-6 text-sm text-[#495057] space-y-2">
          <p><strong>Payment Methods:</strong> The Board accepts payment by check, money order, or credit card (Visa, Mastercard) through the online portal.</p>
          <p><strong>Returned Checks:</strong> A $50.00 fee is assessed for returned checks.</p>
          <p><strong>Refunds:</strong> Application fees are non-refundable.</p>
        </div>
      </div>
    </>
  );
}
