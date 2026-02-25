import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { FileText, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Hygienist Licensure Pathways",
  description: "Learn about pathways to dental hygiene licensure in Louisiana: Licensure by Examination (LBE) and Licensure by Credentials (LBC).",
};

export default function HygienistLicensurePage() {
  return (
    <>
      <PageHeader
        title="Hygienist Licensure Pathways"
        description="Louisiana offers two pathways to dental hygiene licensure. Review the requirements and apply online."
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-t-4 border-t-[#0077B6]">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Licensure by Examination (LBE)</CardTitle>
              <p className="text-sm text-[#495057]">For graduates of CODA-accredited dental hygiene programs</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-[family-name:var(--font-oswald)] text-base font-semibold text-[#005f8f] uppercase tracking-wide">Requirements</h3>
              <ul className="space-y-2">
                {["Graduation from a CODA-accredited dental hygiene program", "Successful completion of the National Board Dental Hygiene Examination (NBDHE)", "Successful completion of a regional clinical examination (ADEX, CRDTS, SRTA, or WREB)", "Current BLS certification (American Heart Association BLS Provider or American Red Cross BLS)", "Criminal fingerprint background check", "ADEX clinical examination completed within 3 years of application", "Jurisprudence examination administered by the Board", "Application fee: $180.00"].map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-1 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-[#495057]">{req}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] mt-4">
                <a href={EXTERNAL_LINKS.hygienistLogin} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />Apply for LBE<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-[#0077B6]">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Licensure by Credentials (LBC)</CardTitle>
              <p className="text-sm text-[#495057]">For dental hygienists currently licensed in another U.S. state</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-[family-name:var(--font-oswald)] text-base font-semibold text-[#005f8f] uppercase tracking-wide">Requirements</h3>
              <ul className="space-y-2">
                {["Active, unrestricted dental hygiene license in another U.S. state", "Minimum of one (1) year of active clinical practice (minimum 1,000 hours)", "No disciplinary actions or pending complaints", "Graduation from a CODA-accredited dental hygiene program", "Current BLS certification (American Heart Association BLS Provider or American Red Cross BLS)", "Criminal fingerprint background check", "ADEX clinical examination completed within 3 years of application", "Jurisprudence examination administered by the Board", "Verification of licensure from all states where licensed", "Application fee: $830.00"].map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-1 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-[#495057]">{req}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] mt-4">
                <a href={EXTERNAL_LINKS.hygienistLogin} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />Apply for LBC<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 bg-[#CAF0F8]/30 rounded-xl p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide mb-4">Additional Information</h2>
          <div className="space-y-3 text-sm text-[#495057]">
            <p>Applications are submitted through the Board&apos;s online portal. Processing times are typically 3-4 weeks for LBE and 4-6 weeks for LBC applications.</p>
            <p>For LBE questions, contact Iris Pourciau at <a href="mailto:iris@lsbd.org" className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">iris@lsbd.org</a>. For LBC questions, contact Alexx Smith at <a href="mailto:alexx@lsbd.org" className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">alexx@lsbd.org</a>. You may also reach the Board office at <a href="tel:2252197330" className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">225-219-7330</a>.</p>
          </div>
        </div>
      </div>
    </>
  );
}
