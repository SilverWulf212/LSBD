import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accessibility, Globe, Lock, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Policies",
  description: "Board policies, accessibility statement, and privacy information.",
};

export default function PoliciesPage() {
  return (
    <>
      <PageHeader title="Policies" description="Board policies, accessibility statement, and privacy information." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Accessibility className="h-5 w-5 text-[#0077B6]" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Accessibility Statement</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
            <p>The Louisiana State Board of Dentistry is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.</p>
            <p><strong>Conformance Status:</strong> This website strives to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA and Section 508 of the Rehabilitation Act.</p>
            <p><strong>Measures Taken:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Semantic HTML structure with proper heading hierarchy</li>
              <li>ARIA landmarks and labels for screen reader navigation</li>
              <li>Skip navigation link for keyboard users</li>
              <li>Minimum 4.5:1 color contrast ratio for text</li>
              <li>Minimum 44x44 CSS pixel touch targets</li>
              <li>Keyboard accessible navigation and interactive elements</li>
              <li>Descriptive alt text for all informative images</li>
              <li>Accessible tables with captions and header scoping</li>
              <li>Visible focus indicators on all interactive elements</li>
            </ul>
            <p><strong>Feedback:</strong> If you encounter accessibility barriers on this website, please contact us at <a href="mailto:admin@lsbd.org" className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">admin@lsbd.org</a> or <a href="tel:2252197330" className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">225-219-7330</a>. We welcome your feedback.</p>
          </CardContent>
        </Card>
        <Card id="privacy">
          <CardHeader>
            <div className="flex items-center gap-2"><Lock className="h-5 w-5 text-[#0077B6]" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Privacy Policy</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
            <p>The Board is committed to protecting the privacy of visitors to our website. We do not collect personal information unless you voluntarily provide it, such as when submitting a form or sending an email.</p>
            <p>Information collected through the licensee portal is governed by the Board&apos;s data management policies and applicable Louisiana law. License information that is public record may be disclosed in accordance with the Louisiana Public Records Act.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-[#0077B6]" aria-hidden="true" /><CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">External Links Disclaimer</CardTitle></div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-[#495057]">
            <p>This website contains links to external websites for the convenience of visitors. The Board does not endorse, control, or guarantee the accuracy, relevance, or completeness of information found on linked external sites. Linking to an external site does not constitute an endorsement by the Board.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
