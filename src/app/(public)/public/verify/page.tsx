import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "@/components/shared/external-link";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { Search, Shield, Info } from "lucide-react";

export const metadata: Metadata = {
  title: "Verify a License",
  description: "Verify the license status of a dental professional in Louisiana using the Board verification system.",
};

export default function VerifyPage() {
  return (
    <>
      <PageHeader title="Verify a License" description="Search for a dental professional to verify their license status, type, and any public disciplinary history." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          <Card className="border-t-4 border-t-[#0077B6]">
            <CardHeader className="text-center">
              <div className="rounded-full bg-[#CAF0F8] p-4 w-fit mx-auto mb-2"><Search className="h-8 w-8 text-[#0077B6]" aria-hidden="true" /></div>
              <CardTitle className="font-[family-name:var(--font-oswald)] text-2xl text-[#005f8f] uppercase tracking-wide">License Verification System</CardTitle>
              <p className="text-sm text-[#495057] mt-2">Use the Board&apos;s online verification system to look up any dental or dental hygiene license in Louisiana.</p>
            </CardHeader>
            <CardContent className="text-center">
              <Button asChild size="lg" className="bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px]">
                <a href={EXTERNAL_LINKS.licenseVerification} target="_blank" rel="noopener noreferrer">
                  <Search className="h-5 w-5 mr-2" aria-hidden="true" />Search Licenses<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
              <p className="text-xs text-gray-500 mt-3">You will be directed to the Board&apos;s verification portal.</p>
            </CardContent>
          </Card>

          <div className="mt-8 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <Info className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-sm text-[#005f8f]">What You Can Look Up</h2>
                  <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>License status (active, inactive, expired, revoked, suspended)</li>
                    <li>License type (dentist, dental hygienist)</li>
                    <li>License number and issue date</li>
                    <li>Public disciplinary actions</li>
                    <li>Anesthesia and sedation permits</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-[#CAF0F8]/30 rounded-lg p-4">
              <div className="flex gap-2">
                <Shield className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-sm text-[#005f8f]">Written Verification</h2>
                  <p className="mt-1 text-sm text-[#495057]">For a written verification letter (e.g., for licensure in another state), contact the Board office. The fee is $25.00 per verification.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
