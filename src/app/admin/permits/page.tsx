import React from "react";
import Link from "next/link";
import { requireCapability } from "@/lib/auth-utils";
import { can } from "@/lib/auth-capabilities";
import { getPermitList } from "@/lib/staff-data";
import { formatCentralDate } from "@/lib/central-time";
import type { PermitRow } from "@/lib/staff-permits";
import type { RawSearchParams } from "@/lib/staff-query";
import { ServerTable, type ServerTableColumn } from "@/components/admin/server-table";
import { PermitHolder } from "@/components/admin/permit-holder";
import { NotLinked } from "@/components/admin/not-linked";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Permits | Admin",
};

export const dynamic = "force-dynamic";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const trim = (v: string | null) => (v === null ? null : v.trim() || null);

export default async function PermitsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await requireCapability("permits.read");
  const canOpenLicensee = can(session.user.role, "licensees.read");
  const sp = await searchParams;

  let data: Awaited<ReturnType<typeof getPermitList>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getPermitList(sp);
  } catch (e) {
    console.error("permit list load failed", e);
    loadError = "Could not read permit records from the database.";
  }

  const columns: ServerTableColumn<PermitRow>[] = [
    {
      header: "Holder",
      cell: (r) => <PermitHolder row={r} canOpenLicensee={canOpenLicensee} />,
    },
    { header: "Licence no.", cell: (r) => trim(r.holderLicenseNumber) ?? "—" },
    { header: "Kind", cell: (r) => (r.kind === "office" ? "Office" : "Personal") },
    { header: "Type", cell: (r) => trim(r.typeName) ?? <NotLinked /> },
    { header: "Level", cell: (r) => r.level ?? "—" },
    { header: "Issued", cell: (r) => formatCentralDate(r.issueDate) },
    {
      header: "Firm",
      cell: (r) => {
        if (r.kind !== "office") return "—";
        return r.firmId !== null ? (
          <Link href={`/admin/firms/${r.firmId}`} className="text-primary hover:underline">
            {trim(r.firmName) ?? `Firm ${r.firmId}`}
          </Link>
        ) : (
          <>
            Office #{r.officeId ?? "?"} <NotLinked />
          </>
        );
      },
    },
  ];

  const f = data?.filters;
  // A hand-edited ?type=nitrous still selects the "Nitrous" option.
  const selectedType = data?.options.types.find((t) => t.toLowerCase() === f?.type.toLowerCase()) ?? f?.type ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Permits</h1>
        <p className="text-sm text-muted-foreground">
          Permits held by licensees and offices. Records are read-only. Anesthesia and sedation permits are found
          with the Type filter.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action="/admin/permits" method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="kind">Kind</Label>
              <select id="kind" name="kind" defaultValue={f?.kind ?? ""} className={SELECT_CLASS}>
                <option value="">All</option>
                <option value="personal">Personal</option>
                <option value="office">Office</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" defaultValue={selectedType} className={SELECT_CLASS}>
                <option value="">All</option>
                {data?.options.types.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="level">Level</Label>
              <select id="level" name="level" defaultValue={f?.level ?? ""} className={SELECT_CLASS}>
                <option value="">All</option>
                {data?.options.levels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">Search</Button>
              <Button asChild variant="outline">
                <Link href="/admin/permits">Clear</Link>
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

      {data && f && (
        <ServerTable
          columns={columns}
          rows={data.result.rows}
          rowKey={(r) => r.id}
          total={data.result.total}
          page={data.result.page}
          pageSize={data.result.pageSize}
          basePath="/admin/permits"
          params={{ kind: f.kind, type: f.type, level: f.level }}
          emptyText="No permits match these filters."
        />
      )}
    </div>
  );
}
