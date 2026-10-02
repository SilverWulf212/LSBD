import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_DOCUMENTS } from "@/lib/lsbd-org-documents";
import { PdfLink } from "@/components/shared/pdf-link";
import { AlertTriangle, Shield, FileText, Phone, ArrowRight } from "lucide-react";
import { CONTACT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "File a Complaint",
  description: "How to file a complaint against a dental professional with the Louisiana State Board of Dentistry.",
};

export default function ComplaintsPage() {
  return (
    <>
      <PageHeader title="File a Complaint" description="If you have concerns about a dental professional, the Board provides a formal complaint process." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide mb-4">How to File a Complaint</h2>
              <div className="space-y-4">
                {[
                  { step: 1, title: "Download the Complaint Form", desc: "Download and complete the official complaint form. Provide as much detail as possible, including names, dates, and a description of the incident." },
                  { step: 2, title: "Submit Your Complaint", desc: "Mail or email the completed form to the Board office. You may include supporting documentation such as records, photos, or correspondence." },
                  { step: 3, title: "Investigation", desc: "The Board will review your complaint and conduct an investigation. This may include obtaining records, interviewing witnesses, and consulting with experts." },
                  { step: 4, title: "Resolution", desc: "You will be notified of the outcome. Possible outcomes include dismissal, letter of concern, consent agreement, formal hearing, or license action." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="rounded-full bg-[#0077B6] text-white w-10 h-10 flex items-center justify-center text-sm font-bold shrink-0">{item.step}</div>
                    <div>
                      <h3 className="font-[family-name:var(--font-oswald)] text-base font-semibold text-[#005f8f] uppercase tracking-wide">{item.title}</h3>
                      <p className="text-sm text-[#495057] mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide mb-4">What to Expect</h2>
              <div className="bg-[#CAF0F8]/30 rounded-xl p-6 space-y-3 text-sm text-[#495057]">
                <p>All complaints are taken seriously and investigated thoroughly. The investigation process is confidential.</p>
                <p>The Board has jurisdiction over licensed dentists, dental hygienists, and dental assistants in Louisiana. The Board does not resolve fee disputes or malpractice claims, but it does investigate allegations of substandard care, unprofessional conduct, and violations of the Dental Practice Act.</p>
                <p>Investigation timelines vary depending on the complexity of the case, but you will be kept informed of the status of your complaint.</p>
              </div>
            </section>
          </div>
          <div className="space-y-6">
            <Card className="border-t-4 border-t-amber-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">Complaint Form</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-sm text-[#495057]">Download the official complaint form to begin the process.</p>
                <PdfLink href={SITE_DOCUMENTS.complaint_form.href} fileSize={SITE_DOCUMENTS.complaint_form.bytes} className="font-medium">Complaint Form (PDF)</PdfLink>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-[#0077B6]" aria-hidden="true" />
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">Contact Us</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm text-[#495057]">
                <p>If you have questions about the complaint process, contact the Board office:</p>
                <p><a href={`tel:${CONTACT.phone.replace(/-/g, "")}`} className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">{CONTACT.phone}</a></p>
                <p><a href={`mailto:${CONTACT.email}`} className="text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">{CONTACT.email}</a></p>
                <p>{CONTACT.physicalAddress}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
