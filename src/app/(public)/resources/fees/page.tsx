import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FeeTable } from "@/components/content/fee-table";
import { MOCK_FEES_DENTIST, MOCK_FEES_HYGIENIST, MOCK_FEES_MISC } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Fee Schedule",
  description: "Complete schedule of fees for dental and dental hygiene licensure, renewal, permits, and other Board services.",
};

export default function FeesPage() {
  return (
    <>
      <PageHeader title="Fee Schedule" description="All fees are established by the Board in accordance with the Dental Practice Act. Fees are subject to change." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        <FeeTable caption="Dentist Fees" fees={MOCK_FEES_DENTIST} />
        <FeeTable caption="Dental Hygienist Fees" fees={MOCK_FEES_HYGIENIST} />
        <FeeTable caption="Miscellaneous Fees" fees={MOCK_FEES_MISC} />
        <div className="bg-[#CAF0F8]/30 rounded-xl p-6 text-sm text-[#495057] space-y-2">
          <p><strong>Payment Methods:</strong> The Board accepts payment by check, money order, or credit card (Visa, Mastercard) through the online portal.</p>
          <p><strong>Returned Checks:</strong> A $50.00 fee is assessed for returned checks.</p>
          <p><strong>Refunds:</strong> Application fees are non-refundable.</p>
        </div>
      </div>
    </>
  );
}
