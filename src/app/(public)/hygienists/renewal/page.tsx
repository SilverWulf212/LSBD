import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { LogIn, DollarSign, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Hygienist License Renewal",
  description: "Annual dental hygiene license renewal process, deadlines, fees, and CE requirements.",
};

export default function HygienistRenewalPage() {
  return (
    <>
      <PageHeader title="Hygienist License Renewal" description="All Louisiana dental hygiene licenses expire on December 31 each year. Renew online through the licensee portal." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-[#0077B6] text-white rounded-xl p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold uppercase tracking-wide">Renew Your License Online</h2>
              <p className="mt-1 text-white/90 text-sm">Log in to the licensee portal to complete your annual renewal.</p>
            </div>
            <Button asChild size="lg" className="bg-white text-[#005f8f] hover:bg-[#CAF0F8] font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] shrink-0">
              <a href={EXTERNAL_LINKS.licenseeLogin} target="_blank" rel="noopener noreferrer">
                <LogIn className="h-5 w-5 mr-2" aria-hidden="true" />Licensee Portal<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide">Renewal Timeline</h2>
            <div className="space-y-4">
              {[
                { date: "October 1", title: "Renewal Period Opens", desc: "Online renewal applications become available." },
                { date: "December 31", title: "Renewal Deadline", desc: "Applications and fees must be received by this date." },
                { date: "January 1", title: "Late Period Begins", desc: "A $100.00 late fee is assessed." },
                { date: "March 31", title: "Final Deadline", desc: "Licenses not renewed require reinstatement." },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-[#0077B6] text-white w-10 h-10 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                    {i < 3 && <div className="w-0.5 h-full bg-[#CAF0F8] mt-2" aria-hidden="true" />}
                  </div>
                  <div className="pb-6">
                    <p className="text-xs font-medium text-[#0077B6] uppercase tracking-wide">{item.date}</p>
                    <h3 className="font-[family-name:var(--font-oswald)] text-base font-semibold text-[#005f8f] uppercase tracking-wide mt-0.5">{item.title}</h3>
                    <p className="text-sm text-[#495057] mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#0077B6]" aria-hidden="true" />
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">Renewal Fees</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#495057]">Annual Renewal</span><span className="font-semibold text-[#005f8f]">$150.00</span></div>
                <div className="flex justify-between"><span className="text-[#495057]">Late Fee (after Dec 31)</span><span className="font-semibold text-red-600">$100.00</span></div>
                <Link href="/resources/fees" className="inline-flex items-center gap-1 text-sm text-[#005f8f] hover:text-[#003f5f] mt-2 transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded">
                  Full fee schedule <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#0077B6]" aria-hidden="true" />
                  <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">Renewal Checklist</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {["12 hours of approved CE completed", "BLS certification current", "3 hours opioid management CE", "No address changes unreported"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#495057]">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />{item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-sm text-amber-800">Important</h3>
                  <p className="text-sm text-amber-700 mt-1">Practicing with an expired license may result in disciplinary action by the Board.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
