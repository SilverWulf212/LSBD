import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Info } from "lucide-react";
import {
  getPublicLicensees,
  groupByType,
  isExpired,
  licenseDetailHref,
  parseLicenseType,
  TYPE_LABEL,
  STATUS_LABEL,
  type PublicLicensee,
} from "@/lib/public-verify";
import { formatCentralDate } from "@/lib/central-time";

interface PageProps {
  params: Promise<{ license_id: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { license_id } = await params;
  const type = parseLicenseType((await searchParams).type);
  const decoded = decodeURIComponent(license_id);
  const label = type ? `${TYPE_LABEL[type]} license ${decoded}` : `License ${decoded}`;
  return {
    title: `${label} — Verify`,
    description: `License verification record for ${label.toLowerCase()} from the Louisiana State Board of Dentistry.`,
  };
}

function fullName(r: PublicLicensee): string {
  if (r.license_name) return r.license_name;
  return [r.prefix, r.first_name, r.middle_name, r.last_name, r.suffix]
    .filter(Boolean)
    .join(" ");
}

export default async function LicenseDetailPage({ params, searchParams }: PageProps) {
  const { license_id } = await params;
  const decoded = decodeURIComponent(license_id);
  const type = parseLicenseType((await searchParams).type);

  const rows = await getPublicLicensees(decoded, type);
  if (rows.length === 0) notFound();

  const groups = groupByType(rows);
  const multipleTypes = groups.length > 1;
  const title = type ? `${TYPE_LABEL[type]} License ${decoded}` : `License ${decoded}`;
  const description =
    rows.length === 1
      ? `Verification record for ${fullName(rows[0])}`
      : `${rows.length} verification records share this license number`;

  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/public/verify">
              <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
              Back to search
            </Link>
          </Button>

          {multipleTypes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <Info className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-sm text-[#005f8f]">
                    License number {decoded} is held by more than one type of licensee
                  </h2>
                  <p className="mt-1 text-sm text-blue-800">
                    Dentist, hygienist and EDDA licenses are numbered separately. Choose the type
                    you are verifying:
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <li key={g.type}>
                        <Link
                          href={licenseDetailHref(decoded, g.type)}
                          className="inline-block rounded-md border border-blue-300 bg-white px-3 py-1 text-sm text-[#0077B6] hover:underline"
                        >
                          {g.label} {decoded}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {groups.map((g) => (
            <section key={g.type} aria-labelledby={`type-${g.type}`} className="space-y-4">
              {(multipleTypes || g.rows.length > 1) && (
                <h2 id={`type-${g.type}`} className="text-lg font-semibold text-[#005f8f]">
                  {g.label} license {decoded}
                  {g.rows.length > 1 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({g.rows.length} records on file)
                    </span>
                  )}
                </h2>
              )}
              {g.rows.length > 1 && (
                <p className="text-sm text-[#495057]">
                  The Board&apos;s records contain more than one {g.label.toLowerCase()} entry under
                  this number. All are shown; contact the Board office if you need help telling them
                  apart.
                </p>
              )}
              {g.rows.map((r, i) => (
                <LicenseCard key={`${r.type}-${i}`} r={r} />
              ))}
            </section>
          ))}

          <p className="text-xs text-muted-foreground">
            This page reflects the Board&apos;s current verification record. Dates are shown in
            Central time. For a written verification letter, contact the Board office. Verification
            fee: $25.00.
          </p>
        </div>
      </div>
    </>
  );
}

function LicenseCard({ r }: { r: PublicLicensee }) {
  const onProbation = r.status === "PRB";
  const expired = isExpired(r.date_until);
  return (
    <div className="space-y-3">
      {onProbation && r.action && (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-sm text-amber-900">Public disciplinary action</h3>
              <p className="mt-1 text-sm text-amber-900 whitespace-pre-wrap">{r.action}</p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{fullName(r)}</span>
            <span className="flex gap-2">
              <Badge variant={onProbation ? "outline" : "default"}>{STATUS_LABEL[r.status]}</Badge>
              {expired && (
                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800">
                  Expired
                </Badge>
              )}
            </span>
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
              <dd className="mt-1 text-sm">{formatCentralDate(r.date_since, "long")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expires</dt>
              <dd className="mt-1 text-sm">
                {formatCentralDate(r.date_until, "long")}
                {expired && (
                  <span className="block text-xs text-red-800">
                    This expiration date has passed. Contact the Board office to confirm current
                    standing.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
