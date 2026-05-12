import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import {
  getPublicLicensee,
  TYPE_LABEL,
  STATUS_LABEL,
} from "@/lib/public-verify";

interface PageProps {
  params: Promise<{ license_id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { license_id } = await params;
  return {
    title: `License ${license_id} — Verify`,
    description: `License verification record for ${license_id} from the Louisiana State Board of Dentistry.`,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fullName(r: {
  prefix: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  license_name: string | null;
}): string {
  if (r.license_name) return r.license_name;
  return [r.prefix, r.first_name, r.middle_name, r.last_name, r.suffix]
    .filter(Boolean)
    .join(" ");
}

export default async function LicenseDetailPage({ params }: PageProps) {
  const { license_id } = await params;
  const decoded = decodeURIComponent(license_id);

  const r = await getPublicLicensee(decoded);
  if (!r) notFound();

  const onProbation = r.status === "PRB";

  return (
    <>
      <PageHeader
        title={`License ${r.license_id}`}
        description={`Verification record for ${fullName(r)}`}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/public/verify">
              <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
              Back to search
            </Link>
          </Button>

          {onProbation && r.action && (
            <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-sm text-amber-900">Public disciplinary action</h2>
                  <p className="mt-1 text-sm text-amber-900 whitespace-pre-wrap">{r.action}</p>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{fullName(r)}</span>
                <Badge variant={onProbation ? "outline" : "default"}>
                  {STATUS_LABEL[r.status]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">License number</dt>
                  <dd className="mt-1 font-mono text-sm">{r.license_id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</dt>
                  <dd className="mt-1 text-sm">{TYPE_LABEL[r.type]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issued</dt>
                  <dd className="mt-1 text-sm">{formatDate(r.date_since)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expires</dt>
                  <dd className="mt-1 text-sm">{formatDate(r.date_until)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            This page reflects the Board&apos;s current verification record.
            For a written verification letter, contact the Board office. Verification fee: $25.00.
          </p>
        </div>
      </div>
    </>
  );
}
