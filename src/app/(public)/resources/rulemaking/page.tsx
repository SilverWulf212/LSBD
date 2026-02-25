import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileEdit, Clock, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Rulemaking",
  description: "Current and past rulemaking proceedings of the Louisiana State Board of Dentistry.",
};

export default function RulemakingPage() {
  return (
    <>
      <PageHeader title="Rulemaking" description="The Board promulgates rules through a public process in accordance with the Louisiana Administrative Procedure Act." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><FileEdit className="h-5 w-5 text-[#0077B6]" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Rulemaking Process</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4 text-sm text-[#495057]">
            <p>The Board follows the Louisiana Administrative Procedure Act (APA) when promulgating, amending, or repealing rules. The process includes:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Notice of Intent:</strong> Published in the Louisiana Register, providing the proposed rule text and inviting public comment.</li>
              <li><strong>Public Comment Period:</strong> A minimum 30-day period during which the public may submit written comments on the proposed rule.</li>
              <li><strong>Public Hearing:</strong> If requested, a public hearing is held where oral testimony may be presented.</li>
              <li><strong>Board Review:</strong> The Board reviews all comments and testimony and may modify the proposed rule.</li>
              <li><strong>Final Rule:</strong> Published in the Louisiana Register with an effective date, typically 20 days after publication.</li>
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-600" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Current Rulemaking Proceedings</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-[#495057]">
            <p>There are no active rulemaking proceedings at this time. Check back for updates or subscribe to the Board&apos;s mailing list for notifications.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Recently Adopted Rules</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-[#495057]">
            <ul className="space-y-3">
              <li className="border-b border-gray-100 pb-3">
                <p className="font-medium text-[#005f8f]">Opioid Management CE Requirements Update</p>
                <p className="text-xs text-gray-500">Effective January 1, 2026</p>
                <p className="mt-1">Established a one-time mandatory three (3) hour opioid management CE requirement for dentists.</p>
              </li>
              <li className="border-b border-gray-100 pb-3">
                <p className="font-medium text-[#005f8f]">Revised Anesthesia Permit Standards</p>
                <p className="text-xs text-gray-500">Effective July 1, 2025</p>
                <p className="mt-1">Updated facility inspection requirements and emergency equipment standards for anesthesia permit holders.</p>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
