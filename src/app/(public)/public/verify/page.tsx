import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, Info } from "lucide-react";
import {
  searchPublicLicensees,
  validateSearch,
  resolveSearchInput,
  isExpired,
  licenseDetailHref,
  TYPE_LABEL,
  STATUS_LABEL,
  MAX_RESULTS,
  type SearchParams,
} from "@/lib/public-verify";
import { formatCentralDate } from "@/lib/central-time";
import { rateLimit } from "@/lib/rate-limit";

export const metadata: Metadata = {
  title: "Verify a License",
  description:
    "Search for a dental professional to verify their license status with the Louisiana State Board of Dentistry.",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    license_id?: string;
    last_name?: string;
    first_name?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params: SearchParams = resolveSearchInput(sp);

  const submitted =
    !!params.licenseId?.trim() ||
    !!params.lastName?.trim() ||
    !!params.firstName?.trim();

  let validationError: string | null = null;
  let rateLimited = false;
  let result: Awaited<ReturnType<typeof searchPublicLicensees>> | null = null;

  if (submitted) {
    const v = validateSearch(params);
    if (!v.ok) {
      validationError = v.reason;
    } else {
      // Rate limit: 30 requests / IP / minute. Falls back to a single bucket
      // if we can't read the IP (some Vercel proxy headers may be absent).
      const hdrs = await headers();
      const ip =
        hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        hdrs.get("x-real-ip") ||
        "unknown";
      const rl = rateLimit(`verify:${ip}`, 30, 60_000);
      if (!rl.ok) {
        rateLimited = true;
      } else {
        try {
          result = await searchPublicLicensees(params);
        } catch (e) {
          validationError = e instanceof Error ? e.message : "Search failed.";
        }
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Verify a License"
        description="Search for a dental professional to verify their license status, type, and any public disciplinary history."
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="border-t-4 border-t-[#0077B6]">
            <CardHeader className="text-center">
              <div className="rounded-full bg-[#CAF0F8] p-4 w-fit mx-auto mb-2">
                <Search className="h-8 w-8 text-[#0077B6]" aria-hidden="true" />
              </div>
              <CardTitle className="font-[family-name:var(--font-oswald)] text-2xl text-[#005f8f] uppercase tracking-wide">
                License Verification System
              </CardTitle>
              <p className="text-sm text-[#495057] mt-2">
                Enter a license number or at least two letters of a last name.
              </p>
            </CardHeader>
            <CardContent>
              <form method="GET" className="space-y-4" aria-label="License search form">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="license_id" className="block text-sm font-medium text-[#005f8f] mb-1">
                      License number
                    </label>
                    <input
                      id="license_id"
                      name="license_id"
                      type="text"
                      defaultValue={params.licenseId}
                      autoComplete="off"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-[#005f8f] mb-1">
                      Last name (prefix)
                    </label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      defaultValue={params.lastName}
                      autoComplete="off"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-[#005f8f] mb-1">
                      First name (prefix)
                    </label>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      defaultValue={params.firstName}
                      autoComplete="off"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-[#005f8f] mb-1">
                      Type
                    </label>
                    <select
                      id="type"
                      name="type"
                      defaultValue={params.type}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="all">All</option>
                      <option value="D">Dentist</option>
                      <option value="H">Hygienist</option>
                      <option value="E">EDDA</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide rounded-md px-6 py-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Search className="h-4 w-4 inline-block mr-2" aria-hidden="true" />
                    Search
                  </button>
                  {submitted && (
                    <Link
                      href="/public/verify"
                      className="text-sm text-[#0077B6] hover:underline"
                    >
                      Clear
                    </Link>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Validation / rate-limit messages */}
          {validationError && (
            <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">{validationError}</p>
            </div>
          )}
          {rateLimited && (
            <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                Too many searches from your network. Please wait a minute and try again.
              </p>
            </div>
          )}

          {/* Results */}
          {result && !rateLimited && !validationError && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {result.total === 0
                    ? "No matches found"
                    : `${result.rows.length} of ${result.total} match${result.total === 1 ? "" : "es"}${
                        result.hasMore ? ` (capped at ${MAX_RESULTS}; narrow your search)` : ""
                      }`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search. Only currently active licensees and those on probation are listed.
                  </p>
                ) : (
                  <>
                    {params.licenseId && new Set(result.rows.map((r) => r.type)).size > 1 && (
                      <p className="mb-3 text-sm text-[#495057]">
                        License number <span className="font-mono">{params.licenseId}</span> is held by
                        more than one type of licensee. Check the <strong>Type</strong> column to find the
                        record you need.
                      </p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr className="text-left">
                            <th className="py-2 px-2 font-semibold">License</th>
                            <th className="py-2 px-2 font-semibold">Name</th>
                            <th className="py-2 px-2 font-semibold">Type</th>
                            <th className="py-2 px-2 font-semibold">Status</th>
                            <th className="py-2 px-2 font-semibold">Issued</th>
                            <th className="py-2 px-2 font-semibold">Expires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((r, i) => (
                            <tr
                              key={`${r.type}-${r.license_id}-${i}`}
                              className="border-b last:border-b-0 hover:bg-muted/30"
                            >
                              <td className="py-2 px-2 font-mono">
                                <Link
                                  href={licenseDetailHref(r.license_id, r.type)}
                                  className="text-[#0077B6] hover:underline"
                                >
                                  {r.license_id}
                                </Link>
                              </td>
                              <td className="py-2 px-2">
                                {(r.last_name ?? "").toUpperCase()}, {r.first_name ?? ""}
                              </td>
                              <td className="py-2 px-2 font-medium">{TYPE_LABEL[r.type]}</td>
                              <td className="py-2 px-2">
                                <Badge variant={r.status === "ACT" ? "default" : "outline"}>
                                  {STATUS_LABEL[r.status]}
                                </Badge>
                              </td>
                              <td className="py-2 px-2">{formatCentralDate(r.date_since)}</td>
                              <td className="py-2 px-2">
                                {formatCentralDate(r.date_until)}
                                {isExpired(r.date_until) && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 border-red-300 bg-red-50 text-red-800"
                                  >
                                    Expired
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {result.rows.some((r) => isExpired(r.date_until)) && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        <strong>Expired</strong> means the expiration date on record has passed. Contact
                        the Board office to confirm this licensee&apos;s current standing. Dates are shown
                        in Central time.
                      </p>
                    )}

                    {/* Pagination */}
                    {result.total > result.pageSize && (
                      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">
                          Page {result.page} of {Math.ceil(result.total / result.pageSize)}
                        </div>
                        <div className="flex gap-2">
                          {result.page > 1 && (
                            <PaginationLink
                              params={params}
                              page={result.page - 1}
                              label="Previous"
                            />
                          )}
                          {result.page * result.pageSize < result.total && (
                            <PaginationLink
                              params={params}
                              page={result.page + 1}
                              label="Next"
                            />
                          )}
                        </div>
                      </nav>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {!submitted && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-sm text-[#005f8f]">What you can look up</h2>
                    <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>License status (active or probation)</li>
                      <li>License type (dentist, hygienist, EDDA)</li>
                      <li>License number, issue and expiration dates</li>
                      <li>Public disciplinary actions, if any</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="bg-[#CAF0F8]/30 rounded-lg p-4">
                <div className="flex gap-2">
                  <Shield className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-sm text-[#005f8f]">Written verification</h2>
                    <p className="mt-1 text-sm text-[#495057]">
                      For a written verification letter (e.g., for licensure in another state), contact the Board office. The fee is $25.00 per verification.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function PaginationLink({
  params,
  page,
  label,
}: {
  params: SearchParams;
  page: number;
  label: string;
}) {
  const url = new URLSearchParams();
  if (params.licenseId) url.set("license_id", params.licenseId);
  if (params.lastName) url.set("last_name", params.lastName);
  if (params.firstName) url.set("first_name", params.firstName);
  if (params.type && params.type !== "all") url.set("type", params.type);
  url.set("page", String(page));
  return (
    <Link
      href={`/public/verify?${url.toString()}`}
      className="rounded-md border px-3 py-1 hover:bg-muted"
    >
      {label}
    </Link>
  );
}
