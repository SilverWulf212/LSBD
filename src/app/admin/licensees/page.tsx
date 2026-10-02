import React from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { requireCapability } from "@/lib/auth-utils";
import { getLicenseeList } from "@/lib/staff-data";
import { formatCentralDate } from "@/lib/central-time";
import {
  LICENSE_STATUSES, LICENSE_TYPES, classLabel, formatPersonName, statusLabel, typeLabel,
} from "@/lib/staff-labels";
import { licenceOddities } from "@/lib/staff-oddities";
import { parseLicenseeFilters, type LicenseeListRow } from "@/lib/staff-licensees";
import type { RawSearchParams } from "@/lib/staff-query";
import { ServerTable, type ServerTableColumn } from "@/components/admin/server-table";
import { OddityBadges } from "@/components/admin/oddity-badges";
import { SELECT_CLASS, trim } from "@/components/admin/staff-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Licensees | Admin",
};

export const dynamic = "force-dynamic";

function NoLicence() {
  return <span className="text-muted-foreground italic">No licence record</span>;
}

export default async function LicenseesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireCapability("licensees.read");
  const sp = await searchParams;

  let data: Awaited<ReturnType<typeof getLicenseeList>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getLicenseeList(sp);
  } catch (e) {
    unstable_rethrow(e);
    console.error("licensee list load failed", e);
    loadError = "Could not read licensee records from the database.";
  }

  const now = new Date();
  const columns: ServerTableColumn<LicenseeListRow>[] = [
    {
      header: "Name",
      cell: (r) => (
        <Link href={`/admin/licensees/${r.key}`} className="font-medium text-primary hover:underline">
          {formatPersonName({
            lastName: trim(r.lastName),
            firstName: trim(r.firstName),
            middleName: trim(r.middleName),
            suffix: trim(r.suffix),
          })}
        </Link>
      ),
    },
    { header: "Licence no.", cell: (r) => (r.hasLicence ? (r.licenseNumber ?? "—") : <NoLicence />) },
    { header: "Type", cell: (r) => (r.hasLicence ? typeLabel(r.type) : "—") },
    {
      header: "Status",
      cell: (r) =>
        r.hasLicence ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            {statusLabel(r.status)}
            <OddityBadges oddities={licenceOddities(r, now)} />
          </span>
        ) : (
          "—"
        ),
    },
    { header: "Class", cell: (r) => (r.hasLicence ? classLabel(r.class) : "—") },
    { header: "Expires", cell: (r) => (r.hasLicence ? formatCentralDate(r.dateUntil) : "—") },
    { header: "Office city", cell: (r) => trim(r.officeCity) ?? "—" },
  ];

  // Parsed from the request, not the loaded data, so a failed load keeps what was typed.
  const f = parseLicenseeFilters(sp);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Licensees</h1>
        <p className="text-sm text-muted-foreground">
          Search dentists, hygienists and EDDAs. Records are read-only.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form key={JSON.stringify({ ...f, page: 0 })} action="/admin/licensees" method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="last">Last or married name</Label>
              <Input id="last" name="last" defaultValue={f.last ?? ""} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="first">First name</Label>
              <Input id="first" name="first" defaultValue={f.first ?? ""} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="number">Licence number</Label>
              <Input id="number" name="number" defaultValue={f.number ?? ""} maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Office city</Label>
              <Input id="city" name="city" defaultValue={f.city ?? ""} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" defaultValue={f.type ?? ""} className={SELECT_CLASS}>
                <option value="">All</option>
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={f.status ?? ""} className={SELECT_CLASS}>
                <option value="">All</option>
                {LICENSE_STATUSES.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
                <option value="none">No status</option>
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">Search</Button>
              <Button asChild variant="outline">
                <Link href="/admin/licensees">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loadError && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {loadError}
        </div>
      )}

      {data && (
        <ServerTable
          columns={columns}
          rows={data.result.rows}
          rowKey={(r) => r.key}
          total={data.result.total}
          page={data.result.page}
          pageSize={data.result.pageSize}
          basePath="/admin/licensees"
          params={{
            last: f.last,
            first: f.first,
            number: f.number,
            type: f.type,
            status: f.status,
            city: f.city,
          }}
          emptyText="No licensees match these filters."
        />
      )}
    </div>
  );
}
