import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, RefreshCw, GraduationCap, Syringe, ArrowRight, LogIn, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EXTERNAL_LINKS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Dentists",
  description:
    "Information for dentists licensed in Louisiana, including licensure, renewal, and continuing education requirements.",
};

const SECTIONS = [
  {
    title: "Licensure Pathways",
    description:
      "Louisiana offers two pathways to dental licensure: Licensure by Examination (LBE) for clinical exam candidates, and Licensure by Credentials (LBC) for dentists licensed in other states.",
    href: "/dentists/licensure",
    icon: ClipboardCheck,
  },
  {
    title: "License Renewal",
    description:
      "All dental licenses expire on December 31 each year. Renew online through the licensee portal before the deadline to avoid late fees.",
    href: "/dentists/renewal",
    icon: RefreshCw,
  },
  {
    title: "Continuing Education",
    description:
      "Dentists must complete a minimum of 20 hours of approved continuing education annually, including BLS certification and opioid management.",
    href: "/dentists/continuing-ed",
    icon: GraduationCap,
  },
];

export default function DentistsPage() {
  return (
    <>
      <PageHeader
        title="Dentists"
        description="Resources, licensing information, and requirements for dental professionals in Louisiana."
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-10">
          <Button
            asChild
            className="bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px]"
          >
            <a href={EXTERNAL_LINKS.licenseeLogin} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
              Apply for a License
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-[#0077B6] text-[#005f8f] hover:bg-[#CAF0F8] font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px]"
          >
            <a href={EXTERNAL_LINKS.licenseeLogin} target="_blank" rel="noopener noreferrer">
              <LogIn className="h-4 w-4 mr-2" aria-hidden="true" />
              Licensee Login
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
        </div>

        {/* Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl"
              >
                <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:border-[#0077B6]/30">
                  <CardHeader>
                    <div className="rounded-lg bg-[#CAF0F8]/50 p-3 w-fit mb-2">
                      <Icon className="h-6 w-6 text-[#0077B6]" aria-hidden="true" />
                    </div>
                    <CardTitle className="font-[family-name:var(--font-oswald)] text-lg text-[#005f8f] uppercase tracking-wide">
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-[#495057] leading-relaxed">
                      {section.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0077B6] mt-4 group-hover:gap-2 transition-all">
                      Learn more
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Anesthesia Info */}
        <div className="mt-12 bg-[#CAF0F8]/30 rounded-xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-[#CAF0F8] p-3 shrink-0">
              <Syringe className="h-6 w-6 text-[#0077B6]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide">
                Anesthesia &amp; Sedation Permits
              </h2>
              <p className="mt-2 text-sm text-[#495057] leading-relaxed max-w-3xl">
                Dentists who administer general anesthesia, deep sedation, or parenteral conscious sedation must
                hold a valid permit issued by the Board. Permits require facility inspection, appropriate training
                documentation, and current ACLS/PALS certification. Permit applications and requirements are
                available on the Forms page.
              </p>
              <Link
                href="/resources/forms"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#005f8f] hover:text-[#003f5f] mt-3 transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
              >
                View permit applications
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
