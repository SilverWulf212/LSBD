import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Scale, DollarSign, FileText, Calendar, Newspaper, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Resources",
  description: "Laws, rules, fees, forms, meeting archives, and publications from the Louisiana State Board of Dentistry.",
};

const RESOURCES = [
  { title: "Laws & Rules", description: "The Dental Practice Act, Board Rules, and related statutes governing dentistry in Louisiana.", href: "/resources/laws-and-rules", icon: Scale },
  { title: "Rulemaking", description: "Current and past rulemaking proceedings, proposed rules, and the rulemaking process.", href: "/resources/rulemaking", icon: BookOpen },
  { title: "Fee Schedule", description: "Complete schedule of fees for licensure, renewals, permits, and other Board services.", href: "/resources/fees", icon: DollarSign },
  { title: "Forms Library", description: "Downloadable applications, permits, and forms required by the Board.", href: "/resources/forms", icon: FileText },
  { title: "Meetings & Minutes", description: "Board meeting schedule, public notices, agendas, and approved minutes.", href: "/resources/meetings", icon: Calendar },
  { title: "Publications", description: "The Bulletin newsletter archive and other Board publications.", href: "/resources/publications", icon: Newspaper },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        title="Resources"
        description="Access laws, rules, fees, forms, meeting records, and publications from the Board."
        image="/images/heroes/hero-clinical.png"
        imageAlt="Clinical dental tools and equipment"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {RESOURCES.map((resource) => {
            const Icon = resource.icon;
            return (
              <Link key={resource.href} href={resource.href} className="group focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl">
                <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:border-[#0077B6]/30">
                  <CardHeader>
                    <div className="rounded-lg bg-[#CAF0F8]/50 p-3 w-fit mb-2"><Icon className="h-6 w-6 text-[#0077B6]" aria-hidden="true" /></div>
                    <CardTitle className="font-[family-name:var(--font-oswald)] text-lg text-[#005f8f] uppercase tracking-wide">{resource.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-[#495057] leading-relaxed">{resource.description}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0077B6] mt-4 group-hover:gap-2 transition-all">View <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
