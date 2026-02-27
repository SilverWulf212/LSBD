import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "@/components/shared/external-link";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { GraduationCap, Heart, Pill, Clock, BookOpen, Syringe, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Dentist CE Requirements",
  description: "Continuing education requirements for Louisiana-licensed dentists, including BLS, ACLS/PALS, and opioid management.",
};

export default function DentistContinuingEdPage() {
  return (
    <>
      <PageHeader
        title="Continuing Education"
        description="Louisiana-licensed dentists must complete continuing education requirements each biennial renewal cycle to maintain active licensure."
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Overview */}
        <div className="bg-[#CAF0F8]/30 rounded-xl p-6 sm:p-8 mb-8">
          <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide mb-3">
            Biennial CE Requirement Overview
          </h2>
          <p className="text-sm text-[#495057] leading-relaxed max-w-3xl">
            Each licensed dentist shall complete a minimum of forty (40) hours of continuing education
            per biennial renewal cycle. Continuing education must be from approved providers and must include the
            specific mandatory topics listed below. CE compliance is tracked through CE Broker. The reporting
            deadline is December 31 of even-numbered years.
          </p>
          <div className="mt-4">
            <ExternalLink href={EXTERNAL_LINKS.ceBroker} className="font-medium">
              Track your CE on CE Broker
            </ExternalLink>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#0077B6]" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">
                  General CE Requirements
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p><strong>Total Hours:</strong> 40 hours per biennial renewal cycle</p>
              <p><strong>Reporting Period:</strong> January 1 through December 31 of even-numbered years</p>
              <p><strong>Reporting Method:</strong> Via CE Broker (free Basic account)</p>
              <p><strong>Approved Providers:</strong> ADA CERP, AGD PACE, and other Board-approved providers</p>
              <p><strong>Carryover:</strong> Excess hours cannot be carried over to the next cycle</p>
              <p><strong>Audit:</strong> The Board conducts random CE audits. Retain certificates for a minimum of 4 years.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">
                  BLS / ACLS / PALS
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p><strong>BLS (Basic Life Support):</strong> Required for all licensees. Must remain current at all times. Counts toward biennial CE hours.</p>
              <p><strong>ACLS (Advanced Cardiovascular Life Support):</strong> Required for dentists holding general anesthesia or parenteral conscious sedation permits.</p>
              <p><strong>PALS (Pediatric Advanced Life Support):</strong> Required for dentists holding permits who treat patients under 13 years of age.</p>
              <p><strong>Approved Providers:</strong> American Heart Association BLS Provider and American Red Cross BLS only.</p>
              <p className="text-red-600 font-medium">Online-only BLS courses are NEVER accepted.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">
                  Opioid Management
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p><strong>Requirement:</strong> Three (3) hours — ONE-TIME requirement (since 2018 renewal cycle) in opioid prescribing, abuse prevention, and pain management.</p>
              <p><strong>Topics May Include:</strong> Responsible opioid prescribing, alternatives to opioids, risk assessment, Louisiana PMP, and treatment of substance use disorders.</p>
              <p><strong>Exemptions:</strong> Dentists who do not prescribe controlled substances may apply for an exemption via notarized affidavit. The exemption form is available on the Forms page.</p>
              <Link
                href="/resources/forms"
                className="inline-flex items-center gap-1 text-[#005f8f] hover:text-[#003f5f] transition-colors font-medium focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
              >
                Exemption form <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Syringe className="h-5 w-5 text-[#0077B6]" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">
                  Anesthesia CE
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p><strong>Requirement:</strong> Six (6) hours of anesthesia-related continuing education per biennial renewal cycle.</p>
              <p><strong>Applicability:</strong> Required for dentists holding sedation or general anesthesia permits.</p>
              <p><strong>Topics May Include:</strong> Sedation pharmacology, airway management, patient monitoring, and emergency protocols.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" aria-hidden="true" />
                <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">
                  CE Broker
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
              <p>The Board uses CE Broker for electronic CE tracking and compliance monitoring. All Louisiana licensees have access to a free CE Broker Basic account.</p>
              <p><strong>Benefits:</strong> Real-time compliance tracking, automatic reporting from approved providers, and audit-ready documentation.</p>
              <p><strong>Getting Started:</strong> Visit CE Broker to create your account and link your Louisiana license number.</p>
              <ExternalLink href={EXTERNAL_LINKS.ceBroker} className="font-medium">
                Visit CE Broker
              </ExternalLink>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
