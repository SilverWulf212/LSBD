import React from "react";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { requireCapability } from "@/lib/auth-utils";
import { can } from "@/lib/auth-capabilities";
import { getFirmDetail } from "@/lib/staff-data";
import { formatCentralDate, formatCentralDateTime } from "@/lib/central-time";
import { FIRM_PERMITS_LIMIT } from "@/lib/staff-permits";
import { safeEmailHref, safeUrlHref } from "@/lib/staff-links";
import { PermitHolder } from "@/components/admin/permit-holder";
import { NotLinked } from "@/components/admin/not-linked";
import { PrintButton } from "@/components/admin/print-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Firm | Admin",
};

export const dynamic = "force-dynamic";

const t = (v: string | null | undefined): string | null => (v == null ? null : v.trim() || null);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Fields({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="break-words">{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function phone(num: string | null, ext: string | null): string | null {
  const n = t(num);
  if (!n) return null;
  return t(ext) ? `${n} ext. ${t(ext)}` : n;
}

/** A link only when safeHref approved the value; otherwise the stored text, unlinked. */
function MaybeLink({ text, href }: { text: string; href: string | null }) {
  return href ? (
    <a href={href} className="text-primary hover:underline" rel="noopener noreferrer">
      {text}
    </a>
  ) : (
    <>{text}</>
  );
}

export default async function FirmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCapability("permits.read");
  const canOpenLicensee = can(session.user.role, "licensees.read");
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getFirmDetail>> = null;
  let loadError: string | null = null;
  try {
    data = await getFirmDetail(id);
  } catch (e) {
    unstable_rethrow(e);
    console.error("firm detail load failed", e);
    loadError = "Could not read this firm record from the database.";
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href="/admin/firms" className="text-sm text-primary hover:underline print:hidden">
          Back to firms
        </Link>
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {loadError}
        </div>
      </div>
    );
  }
  if (!data) notFound();

  const { firm, permits: permitList } = data;
  const permits = permitList.rows;
  const name = t(firm.name) ?? `Firm ${firm.id}`;
  const email = t(firm.email);
  const url = t(firm.url);
  const cityLine = [t(firm.city), [t(firm.state), t(firm.zip)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const address = [t(firm.address1), t(firm.address2), t(firm.address3), cityLine].filter(Boolean).join(" | ");

  return (
    <div className="space-y-4">
      <div className="hidden print:block">
        <p className="text-sm font-semibold">Louisiana State Board of Dentistry — Firm record</p>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-xs">
          Record id {firm.id} · Printed {formatCentralDateTime(new Date())}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/admin/firms" className="text-sm text-primary hover:underline">
            Back to firms
          </Link>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">Record id {firm.id}</p>
        </div>
        <PrintButton />
      </div>

      <Section title="Firm">
        <Fields
          items={[
            ["Registration number", t(firm.number)],
            ["Type", t(firm.type)],
            ["Status", t(firm.status)],
            ["Registration year", t(firm.regYear)],
            ["Registered", formatCentralDate(firm.dateSince)],
            ["Last renewed", formatCentralDate(firm.dateRenew)],
            ["Expires", formatCentralDate(firm.dateUntil)],
            ["Last updated", formatCentralDate(firm.dateUpdated)],
            ["Contact name", t(firm.addrName1)],
            ["Second contact name", t(firm.addrName2)],
            ["Address", address || null],
            ["County", t(firm.county)],
            ["Location", t(firm.location)],
            ["Phone", phone(firm.phone1, firm.ext1)],
            ["Second phone", phone(firm.phone2, firm.ext2)],
            ["Fax", t(firm.fax)],
            ["E-mail", email === null ? null : <MaybeLink key="e" text={email} href={safeEmailHref(email)} />],
            ["Web", url === null ? null : <MaybeLink key="u" text={url} href={safeUrlHref(url)} />],
            ["Office id", firm.officeId],
          ]}
        />
      </Section>

      <Section title="Office permits at this firm">
        {permits.length === 0 ? (
          <p>No office permits are linked to this firm.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {permits.map((p) => (
              <li key={p.id}>
                {t(p.typeName) ?? <NotLinked />}
                {p.level ? ` · level ${p.level}` : ""}
                {` · issued ${formatCentralDate(p.issueDate)}`}
                {" · "}
                <PermitHolder row={p} canOpenLicensee={canOpenLicensee} />
              </li>
            ))}
          </ul>
        )}
        {permitList.truncated && (
          <p className="text-xs text-muted-foreground">Showing the first {FIRM_PERMITS_LIMIT}. More exist.</p>
        )}
        <p className="text-muted-foreground">Linked by office id (unverified link U1).</p>
      </Section>
    </div>
  );
}
