import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, AlertTriangle, ArrowRight, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Public Services",
  description: "Verify a dental professional license or file a complaint with the Louisiana State Board of Dentistry.",
};

export default function PublicPage() {
  return (
    <>
      <PageHeader title="Public Services" description="The Board provides services to protect the public, including license verification and a complaint process." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Link href="/public/verify" className="group focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl">
            <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:border-[#0077B6]/30 border-t-4 border-t-[#0077B6]">
              <CardHeader>
                <div className="rounded-lg bg-[#CAF0F8]/50 p-3 w-fit mb-2"><Search className="h-6 w-6 text-[#0077B6]" aria-hidden="true" /></div>
                <CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">Verify a License</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-[#495057] leading-relaxed">Look up a dental professional to verify their license status, license type, and any disciplinary history. This service is free and available to the public.</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0077B6] mt-4 group-hover:gap-2 transition-all">Verify now <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/public/complaints" className="group focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl">
            <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:border-[#0077B6]/30 border-t-4 border-t-amber-500">
              <CardHeader>
                <div className="rounded-lg bg-amber-50 p-3 w-fit mb-2"><AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" /></div>
                <CardTitle className="font-[family-name:var(--font-oswald)] text-xl text-[#005f8f] uppercase tracking-wide">File a Complaint</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-[#495057] leading-relaxed">Report concerns about a dental professional to the Board. All complaints are investigated confidentially, and you will be kept informed of the process.</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#0077B6] mt-4 group-hover:gap-2 transition-all">Learn more <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
              </CardContent>
            </Card>
          </Link>
        </div>
        <div className="bg-[#CAF0F8]/30 rounded-xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-[#CAF0F8] p-3 shrink-0"><Shield className="h-6 w-6 text-[#0077B6]" aria-hidden="true" /></div>
            <div>
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide">Our Mission</h2>
              <p className="mt-2 text-sm text-[#495057] leading-relaxed max-w-3xl">The primary mission of the Louisiana State Board of Dentistry is the protection of the public. We accomplish this by regulating the professions of dentistry and dental hygiene through licensure, continuing education requirements, and enforcement of the Dental Practice Act.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
