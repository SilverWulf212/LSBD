import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/shared/external-link";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { FileText, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Dentist Licensure Pathways",
  description:
    "Learn about the two pathways to dental licensure in Louisiana: Licensure by Examination (LBE) and Licensure by Credentials (LBC).",
};

export default function DentistLicensurePage() {
  return (
    <>
      <PageHeader
        title="Dentist Licensure Pathways"
        description="Louisiana offers two pathways to dental licensure. Review the requirements below and apply through the online portal."
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LBE Pathway */}
          <Card className="border-t-4 border-t-[#0077B6]">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">
                Licensure by Examination (LBE)
              </CardTitle>
              <p className="text-sm text-[#495057]">
                For graduates of CODA-accredited dental programs seeking initial licensure
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-[family-name:var(--font-oswald)] text-base font-semibold text-[#005f8f] uppercase tracking-wide">
                Requirements
              </h3>
              <ul className="space-y-2">
                {[
                  "Graduation from a CODA-accredited dental school",
                  "Successful completion of the National Board Dental Examinations (NBDE Part I & II or INBDE)",
                  "Successful completion of a regional clinical examination (ADEX, CRDTS, SRTA, or WREB)",
                  "Current BLS certification from an approved provider",
                  "Jurisprudence examination administered by the Board",
                  "Application fee: $300.00",
                ].map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-1 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-[#495057]">{req}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="w-full bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] mt-4"
              >
                <a href={EXTERNAL_LINKS.licenseeLogin} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                  Apply for LBE
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* LBC Pathway */}
          <Card className="border-t-4 border-t-[#0077B6]">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">
                Licensure by Credentials (LBC)
              </CardTitle>
              <p className="text-sm text-[#495057]">
                For dentists currently licensed in another U.S. state or territory
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-[family-name:var(--font-oswald)] text-base font-semibold text-[#005f8f] uppercase tracking-wide">
                Requirements
              </h3>
              <ul className="space-y-2">
                {[
                  "Active, unrestricted dental license in another U.S. state or territory",
                  "Minimum of five (5) years of active clinical practice",
                  "No disciplinary actions or pending complaints in any jurisdiction",
                  "Graduation from a CODA-accredited dental school",
                  "Current BLS certification from an approved provider",
                  "Jurisprudence examination administered by the Board",
                  "Verification of licensure from all states where licensed",
                  "Application fee: $500.00",
                ].map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-1 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-[#495057]">{req}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="w-full bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] mt-4"
              >
                <a href={EXTERNAL_LINKS.licenseeLogin} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                  Apply for LBC
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <div className="mt-10 bg-[#CAF0F8]/30 rounded-xl p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide mb-4">
            Additional Information
          </h2>
          <div className="space-y-3 text-sm text-[#495057]">
            <p>
              All licensure applications are submitted through the Board&apos;s online portal. Processing
              times vary based on the completeness of the application and the time required to obtain
              verifications from other jurisdictions.
            </p>
            <p>
              Applicants should allow at least 4-6 weeks for processing of LBE applications and 6-8
              weeks for LBC applications. Incomplete applications will not be processed.
            </p>
            <p>
              For questions about the licensure process, contact the Board office at{" "}
              <a
                href="mailto:admin@lsbd.org"
                className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
              >
                admin@lsbd.org
              </a>{" "}
              or{" "}
              <a
                href="tel:2252197330"
                className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
              >
                225-219-7330
              </a>
              .
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/resources/fees"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
            >
              View fee schedule
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/resources/forms"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
            >
              View forms library
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
