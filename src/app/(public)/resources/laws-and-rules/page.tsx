import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "@/components/shared/external-link";
import { PdfLink } from "@/components/shared/pdf-link";
import { Scale, BookOpen, FileText, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Laws & Rules",
  description: "The Louisiana Dental Practice Act, Board Rules, and related statutes governing the practice of dentistry and dental hygiene.",
};

export default function LawsAndRulesPage() {
  return (
    <>
      <PageHeader title="Laws & Rules" description="The laws and rules governing the practice of dentistry and dental hygiene in Louisiana." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Scale className="h-5 w-5 text-[#0077B6]" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Louisiana Dental Practice Act</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
            <p>The Dental Practice Act (Louisiana Revised Statutes Title 37, Chapter 8) is the primary law governing the practice of dentistry and dental hygiene in Louisiana. It establishes the Board, defines the scope of practice, licensure requirements, and enforcement authority.</p>
            <p>The full text of the Dental Practice Act is available through the Louisiana Legislature website:</p>
            <ExternalLink href="https://www.legis.la.gov/legis/Law.aspx?d=92616" className="font-medium">Louisiana Dental Practice Act (RS 37:751-800)</ExternalLink>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-[#0077B6]" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Board Rules (Louisiana Administrative Code)</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
            <p>The Board Rules are published in the Louisiana Administrative Code (LAC), Title 46, Professional and Occupational Standards, Part XXXIII. These rules implement the Dental Practice Act and provide detailed requirements for licensure, continuing education, anesthesia permits, and professional conduct.</p>
            <div className="space-y-2">
              <p className="font-medium text-[#005f8f]">Key Chapters:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Chapter 1: General Provisions</li>
                <li>Chapter 3: Dental Licensure</li>
                <li>Chapter 4: Dental Hygiene Licensure</li>
                <li>Chapter 5: Dental Assisting</li>
                <li>Chapter 7: Continuing Education</li>
                <li>Chapter 9: Anesthesia and Sedation</li>
                <li>Chapter 11: Disciplinary Proceedings</li>
              </ul>
            </div>
            <ExternalLink href="https://www.doa.la.gov/doa/osr/louisiana-administrative-code/" className="font-medium">Louisiana Administrative Code</ExternalLink>
          </CardContent>
        </Card>
        <div className="bg-[#CAF0F8]/30 rounded-xl p-6 text-sm text-[#495057]">
          <p className="font-medium text-[#005f8f] mb-2">Related Resources</p>
          <p>For information about proposed rule changes and the rulemaking process, visit the <Link href="/resources/rulemaking" className="text-[#0077B6] hover:text-[#005f8f] font-medium transition-colors">Rulemaking</Link> page. You can also browse the <Link href="/resources/publications" className="text-[#0077B6] hover:text-[#005f8f] font-medium transition-colors">Publications</Link> archive for Board newsletters and bulletins.</p>
        </div>
      </div>
    </>
  );
}
