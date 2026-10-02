import React from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { requireCapability } from "@/lib/auth-utils";
import { getFirmList } from "@/lib/staff-data";
import { formatCentralDate } from "@/lib/central-time";
import { parseFirmFilters, type FirmListRow } from "@/lib/staff-firms";
import type { RawSearchParams } from "@/lib/staff-query";
import { ServerTable, type ServerTableColumn } from "@/components/admin/server-table";
import { SELECT_CLASS, trim } from "@/components/admin/staff-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Firms | Admin",
};

export const dynamic = "force-dynamic";

export default async function FirmsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireCapability("permits.read");
  const sp = await searchParams;

  let data: Awaited<ReturnType<typeof getFirmList>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getFirmList(sp);
  } catch (e) {
    unstable_rethrow(e);
    console.error("firm list load failed", e);
    loadError = "Could not read firm records from the database.";
  }

  const columns: ServerTableColumn<FirmListRow>[] = [
    {
      header: "Name",
      cell: (r) => (
        <Link href={`/admin/firms/${r.id}`} className="font-medium text-primary hover:underline">
          {trim(r.name) ?? `Firm ${r.id}`}
        </Link>
      ),
    },
    { header: "Number", cell: (r) => trim(r.number) ?? "—" },
    { header: "Type", cell: (r) => trim(r.type) ?? "—" },
    { header: "Status", cell: (r) => trim(r.status) ?? "—" },
    { header: "City", cell: (r) => trim(r.city) ?? "—" },
    { header: "State", cell: (r) => trim(r.state) ?? "—" },
    { header: "Expires", cell: (r) => formatCentralDate(r.dateUntil) },
  ];

  // Parsed from the request, not the loaded data, so a failed load keeps what was typed.
  const f = parseFirmFilters(sp);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Firms</h1>
        <p className="text-sm text-muted-foreground">
          Professional LLCs registered with the Board. Records are read-only.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form key={JSON.stringify({ ...f, page: 0 })} action="/admin/firms" method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name contains</Label>
              <Input id="name" name="name" defaultValue={f.name ?? ""} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="number">Registration number</Label>
              <Input id="number" name="number" defaultValue={f.number ?? ""} maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={f.city ?? ""} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={f.status ?? ""} className={SELECT_CLASS}>
                <option value="">All</option>
                {data?.statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">Search</Button>
              <Button asChild variant="outline">
                <Link href="/admin/firms">Clear</Link>
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
        <>
          <ServerTable
            columns={columns}
            rows={data.result.rows}
            rowKey={(r) => r.id}
            total={data.result.total}
            page={data.result.page}
            pageSize={data.result.pageSize}
            basePath="/admin/firms"
            params={{ name: f.name, number: f.number, city: f.city, status: f.status }}
            emptyText="No firms match these filters."
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Professional associations</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {data.associationCount === 0
                ? "No professional associations are on record (the source table is empty)."
                : `${data.associationCount} professional association records exist. This screen does not list them yet.`}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
