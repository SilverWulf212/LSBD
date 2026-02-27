import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Contact, FileText, Shield, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About the Board",
  description: "Learn about the Louisiana State Board of Dentistry, its history, mission, and members.",
};

const SECTIONS = [
  { title: "Board Members", description: "Meet the Board members who oversee dental regulation in Louisiana.", href: "/about/board", icon: Users },
  { title: "Staff Directory", description: "Contact information for Board staff members.", href: "/about/staff", icon: Contact },
  { title: "Policies", description: "Board policies, accessibility statement, and other administrative documents.", href: "/about/policies", icon: FileText },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About the Board"
        description="The Louisiana State Board of Dentistry has regulated the dental profession since 1894."
        image="/images/heroes/hero-consultation.webp"
        imageAlt="Dental professionals in a consultation"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-[#CAF0F8] p-3 shrink-0"><Shield className="h-6 w-6 text-[#0077B6]" aria-hidden="true" /></div>
              <div>
                <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide">Our Mission</h2>
                <p className="mt-2 text-sm text-[#495057] leading-relaxed">The Louisiana State Board of Dentistry exists to protect the public by regulating the professions of dentistry and dental hygiene in the State of Louisiana. We accomplish this through:</p>
                <ul className="mt-3 space-y-2 text-sm text-[#495057]">
                  <li className="flex items-start gap-2"><span className="text-[#0077B6] font-bold" aria-hidden="true">&bull;</span>Licensing qualified dental professionals through rigorous examination and credentialing</li>
                  <li className="flex items-start gap-2"><span className="text-[#0077B6] font-bold" aria-hidden="true">&bull;</span>Enforcing continuing education requirements to ensure practitioners maintain current knowledge</li>
                  <li className="flex items-start gap-2"><span className="text-[#0077B6] font-bold" aria-hidden="true">&bull;</span>Investigating complaints and taking disciplinary action when necessary</li>
                  <li className="flex items-start gap-2"><span className="text-[#0077B6] font-bold" aria-hidden="true">&bull;</span>Promulgating rules that establish standards of practice for the protection of the public</li>
                </ul>
              </div>
            </div>
            <div className="bg-[#CAF0F8]/30 rounded-xl p-6">
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide mb-3">History</h2>
              <div className="space-y-3 text-sm text-[#495057]">
                <p>The Louisiana State Board of Dentistry was established in 1894, making it one of the oldest dental regulatory boards in the United States. For over 130 years, the Board has served as the primary agency responsible for protecting Louisiana citizens from unqualified and incompetent dental practitioners.</p>
                <p>The Board is composed of eight members appointed by the Governor: six licensed dentists representing the six dental districts of Louisiana, one licensed dental hygienist, and one consumer member. Board members serve staggered terms and volunteer their time to oversee the regulation of the dental profession.</p>
                <p>The Board operates under the authority of the Louisiana Dental Practice Act (R.S. 37:751-800) and the rules published in the Louisiana Administrative Code.</p>
              </div>
            </div>
          </div>
          <div>
            <div className="space-y-4">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <Link key={section.href} href={section.href} className="group block focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl">
                    <Card className="transition-all duration-200 group-hover:shadow-md group-hover:border-[#0077B6]/30">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-[#CAF0F8]/50 p-2"><Icon className="h-5 w-5 text-[#0077B6]" aria-hidden="true" /></div>
                          <div>
                            <h3 className="font-[family-name:var(--font-oswald)] font-semibold text-[#005f8f] uppercase tracking-wide text-sm">{section.title}</h3>
                            <p className="text-xs text-[#495057] mt-0.5">{section.description}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-[#0077B6] ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
