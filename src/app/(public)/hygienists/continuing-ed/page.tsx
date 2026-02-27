import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "@/components/shared/external-link";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { Heart, Clock, BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Hygienist CE",
  description: "Continuing education requirements for Louisiana-licensed dental hygienists, including BLS certification.",
};

export default function HygienistContinuingEdPage() {
  return (
    <>
      <PageHeader title="Continuing Education" description="Louisiana-licensed dental hygienists must complete continuing education requirements each biennial renewal cycle." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-[#CAF0F8]/30 rounded-xl p-6 sm:p-8 mb-8">
          <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide mb-3">CE Requirement Overview</h2>
          <p className="text-sm text-[#495057] leading-relaxed max-w-3xl">Each licensed dental hygienist shall complete a minimum of twelve (12) hours of continuing education per biennial renewal cycle from approved providers. CE is reported via CE Broker (free Basic account). The reporting deadline is December 31.</p>
          <div className="mt-4">
            <ExternalLink href={EXTERNAL_LINKS.ceBroker} className="font-medium">Track your CE on CE Broker</ExternalLink>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#0077B6]" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">General CE Requirements</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p><strong>Total Hours:</strong> 12 hours per biennial renewal cycle</p>
              <p><strong>Reporting Deadline:</strong> December 31</p>
              <p><strong>Approved Providers:</strong> ADA CERP, ADHA, and other Board-approved providers</p>
              <p><strong>Carryover:</strong> Excess hours cannot be carried over</p>
              <p><strong>Audit:</strong> Retain certificates for a minimum of 4 years.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">BLS Certification</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p><strong>BLS (Basic Life Support):</strong> Required for all dental hygienists. Must remain current at all times.</p>
              <p><strong>Approved Providers:</strong> American Heart Association BLS Provider or American Red Cross BLS only.</p>
              <p><strong>Important:</strong> Online-only BLS courses are NEVER accepted. A hands-on skills component is required.</p>
              <p>BLS hours count toward your CE requirement. Hygienists holding local anesthesia or nitrous oxide permits must complete 6 hours of anesthesia-related CE per renewal cycle.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">CE Broker</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p>The Board uses CE Broker for electronic CE tracking. All Louisiana hygienists have free Basic account access.</p>
              <ExternalLink href={EXTERNAL_LINKS.ceBroker} className="font-medium">Visit CE Broker</ExternalLink>
            </CardContent>
          </Card>
        </div>
        <div className="mt-8 bg-[#CAF0F8]/30 rounded-xl p-6 text-sm text-[#495057]">
          <p><strong>See also:</strong> <Link href="/hygienists/renewal" className="text-[#0077B6] hover:text-[#005f8f] font-medium transition-colors">Hygienist License Renewal</Link> &middot; <Link href="/hygienists/licensure" className="text-[#0077B6] hover:text-[#005f8f] font-medium transition-colors">Hygienist Licensure Pathways</Link></p>
        </div>
      </div>
    </>
  );
}
