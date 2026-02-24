import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, FileText, BookOpen, Shield, ClipboardCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Dental Assistants",
  description: "Information about dental assisting in Louisiana, including EDDA certification, permitted duties, and Chapter 5 rules.",
};

export default function AssistantsPage() {
  return (
    <>
      <PageHeader title="Dental Assistants" description="Information about dental assisting in Louisiana, including permitted duties, EDDA certification, and applicable rules." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide mb-4">Chapter 5: Dental Assisting Rules</h2>
              <p className="text-sm text-[#495057] leading-relaxed mb-4">
                Dental assistants in Louisiana are governed by Chapter 5 of the Board Rules. Dental assistants do not hold an independent license but work under the direct supervision of a licensed dentist. The Board establishes the permitted and prohibited duties for dental assistants.
              </p>
              <div className="bg-[#CAF0F8]/30 rounded-xl p-6">
                <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-[#005f8f] uppercase tracking-wide mb-3">Permitted Duties Include</h3>
                <ul className="space-y-2">
                  {["Taking radiographs under the supervision of a licensed dentist", "Placing and removing rubber dams", "Taking impressions for study models", "Applying topical anesthetics, fluorides, and sealants", "Removing sutures", "Placing and removing temporary restorations", "Monitoring nitrous oxide under direct supervision (with training)"].map((duty, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#495057]">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />{duty}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section>
              <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide mb-4">Expanded Duty Dental Assistant (EDDA)</h2>
              <p className="text-sm text-[#495057] leading-relaxed mb-4">
                The Expanded Duty Dental Assistant (EDDA) certification allows qualified dental assistants to perform additional clinical procedures beyond the scope of standard dental assisting, including the placement and finishing of direct restorations.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-lg text-[#005f8f] uppercase tracking-wide">EDDA Certification Requirements</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {["Completion of a Board-approved EDDA training course", "Current CPR/BLS certification", "Employment under the supervision of a licensed dentist", "Successful completion of the EDDA competency examination", "Application and fee submitted to the Board", "Certification must be renewed annually"].map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#495057]">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />{req}
                      </li>
                    ))}
                  </ul>
                  <Link href="/resources/forms" className="inline-flex items-center gap-1 text-sm font-medium text-[#005f8f] hover:text-[#003f5f] mt-4 transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">
                    Download EDDA application <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            </section>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#0077B6]" aria-hidden="true" />
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">Quick Links</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {[
                    { label: "Chapter 5 Rules", href: "/resources/laws-and-rules" },
                    { label: "EDDA Application Form", href: "/resources/forms" },
                    { label: "Fee Schedule", href: "/resources/fees" },
                    { label: "Board Contact Info", href: "/about/staff" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="inline-flex items-center gap-1 text-sm text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />{link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-2">
                <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-sm text-amber-800">Supervision Required</h3>
                  <p className="text-sm text-amber-700 mt-1">All dental assistants must work under the direct supervision of a licensed dentist. Independent practice by dental assistants is not permitted in Louisiana.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
