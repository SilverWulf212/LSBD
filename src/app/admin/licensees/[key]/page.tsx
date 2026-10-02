import React from "react";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { requireCapability } from "@/lib/auth-utils";
import { getLicenseeDetail } from "@/lib/staff-data";
import { formatCentralDate, formatCentralDateTime } from "@/lib/central-time";
import {
  ADDRESS_TYPE_LABELS, classLabel, formatPersonName, statusLabel, typeLabel,
} from "@/lib/staff-labels";
import { licenceOddities } from "@/lib/staff-oddities";
import {
  AFFILIATION_LIMIT, DISCIPLINE_LIMIT, OFFICE_AFFILIATION_LIMIT,
  type AddressRow, type AffiliationRow, type LicenseePerson,
} from "@/lib/staff-licensee-detail";
import { PermitFirm } from "@/components/admin/permit-firm";
import { NotLinked } from "@/components/admin/not-linked";
import { OddityBadges } from "@/components/admin/oddity-badges";
import { PrintButton } from "@/components/admin/print-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Licensee | Admin",
};

export const dynamic = "force-dynamic";

// Some source names carry stray whitespace (including carriage returns).
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
          <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CutNote({ n, each }: { n: number; each?: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      Showing the first {n}
      {each ? " in each direction" : ""}. More exist.
    </p>
  );
}

function formatAddress(a: AddressRow): string {
  const stateZip = [t(a.state), t(a.zip)].filter(Boolean).join(" ");
  const cityLine = [t(a.city), stateZip].filter(Boolean).join(", ");
  const county = t(a.county);
  return [t(a.line1), t(a.line2), t(a.line3), cityLine, county ? `${county} County` : null, t(a.country)]
    .filter(Boolean)
    .join(" | ");
}

function phone(num: string | null, ext: string | null): string | null {
  const n = t(num);
  if (!n) return null;
  return t(ext) ? `${n} ext. ${t(ext)}` : n;
}

function nameOf(p: LicenseePerson): string {
  return formatPersonName({
    lastName: t(p.lastName), firstName: t(p.firstName), middleName: t(p.middleName), suffix: t(p.suffix),
  });
}

function AffiliationList({ rows }: { rows: AffiliationRow[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {rows.map((a, i) => (
        <li key={`${a.direction}-${a.otherKey}-${i}`}>
          {a.otherName !== null && a.otherKey !== null ? (
            <>
              <Link href={`/admin/licensees/${a.otherKey}`} className="text-primary hover:underline">
                {a.otherName}
              </Link>
              {a.otherType && a.otherLicenseNumber
                ? ` (${typeLabel(a.otherType)} ${a.otherLicenseNumber})`
                : null}
            </>
          ) : a.otherKey !== null ? (
            <>
              Key {a.otherKey} <NotLinked />
            </>
          ) : (
            <NotLinked />
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function LicenseeDetailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireCapability("licensees.read");
  const { key } = await params;

  let data: Awaited<ReturnType<typeof getLicenseeDetail>> = null;
  let loadError: string | null = null;
  try {
    data = await getLicenseeDetail(key);
  } catch (e) {
    unstable_rethrow(e);
    console.error("licensee detail load failed", e);
    loadError = "Could not read this licensee record from the database.";
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href="/admin/licensees" className="text-sm text-primary hover:underline print:hidden">
          Back to licensees
        </Link>
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {loadError}
        </div>
      </div>
    );
  }
  if (!data) notFound();

  const { detail, caps } = data;
  const { person, contact, licence } = detail;
  const now = new Date();
  const name = nameOf(person);

  const personalPermits = detail.permits.rows.filter((p) => p.kind === "personal");
  const officePermits = detail.permits.rows.filter((p) => p.kind === "office");
  const dentistOf = detail.affiliations.rows.filter((a) => a.direction === "dentist-of");
  const affiliatedTo = detail.affiliations.rows.filter((a) => a.direction === "affiliated-to");

  return (
    <div className="space-y-4">
      <div className="hidden print:block">
        <p className="text-sm font-semibold">Louisiana State Board of Dentistry — Licensee fact sheet</p>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-xs">
          Record key {person.key} · Printed {formatCentralDateTime(now)}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/admin/licensees" className="text-sm text-primary hover:underline">
            Back to licensees
          </Link>
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">Record key {person.key}</p>
        </div>
        <PrintButton />
      </div>

      <Section title="Licence">
        {licence === null ? (
          <p>No licence record exists for this person.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{typeLabel(licence.type)}</Badge>
              <span>{statusLabel(licence.status)}</span>
              <OddityBadges oddities={licenceOddities(licence, now)} />
            </div>
            <Fields
              items={[
                ["Licence number", licence.licenseNumber],
                ["Class", classLabel(licence.class)],
                ["Issued", formatCentralDate(licence.dateSince)],
                ["Expires", formatCentralDate(licence.dateUntil)],
                ["Last renewed", formatCentralDate(licence.dateRenew)],
                ["Inactive since", formatCentralDate(licence.dateInactive)],
                ["Reinstated", formatCentralDate(licence.dateReinstate)],
                ["Registration year", licence.regYear],
                ["Renewal month", licence.renewMonth],
                ["Permit number", licence.permitNumber],
                ["Current", licence.isCurrent === null ? null : licence.isCurrent ? "Yes" : "No"],
                ["Credential exam", licence.credentialExam],
                ["Action", t(licence.action)],
              ]}
            />
          </>
        )}
        <Fields
          items={[
            ["Name on licence", t(person.licenseName)],
            ["Married name", t(person.marriedName)],
          ]}
        />
      </Section>

      <Section title="Other licences of this individual">
        {detail.otherLicences.linked ? (
          detail.otherLicences.rows.length === 0 ? (
            <p>None.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {detail.otherLicences.rows.map((o) => (
                <li key={o.key}>
                  <Link href={`/admin/licensees/${o.key}`} className="text-primary hover:underline">
                    {typeLabel(o.type)} {o.licenseNumber}
                  </Link>
                  {` — ${statusLabel(o.status)}, expires ${formatCentralDate(o.dateUntil)}`}
                </li>
              ))}
            </ul>
          )
        ) : (
          <p>
            <NotLinked detail={detail.otherLicences.reason} />
          </p>
        )}
      </Section>

      {contact && (
        <Section title="Contact">
          <Fields
            items={[
              ["E-mail", t(contact.email)],
              ["Web", t(contact.url)],
              ["Phone", phone(contact.phone1, contact.ext1)],
              ["Second phone", phone(contact.phone2, contact.ext2)],
              ["Fax", t(contact.fax)],
            ]}
          />
        </Section>
      )}

      <Section title="Addresses">
        {detail.addresses.length === 0 ? (
          <p>{caps.contact ? "No addresses on record." : "No office address on record."}</p>
        ) : (
          <ul className="space-y-1">
            {detail.addresses.map((a) => (
              <li key={a.type}>
                <span className="font-medium">{ADDRESS_TYPE_LABELS[a.type] ?? a.type}:</span>{" "}
                {formatAddress(a) || "—"}
              </li>
            ))}
          </ul>
        )}
        {!caps.contact && (
          <p className="text-muted-foreground">Home and permanent addresses are not shown for your role.</p>
        )}
      </Section>

      <Section title="Education">
        {detail.education.rows.map((e, i) => (
          <p key={i}>
            {t(e.school) ?? "School not recorded"}
            {t(e.state) ? `, ${t(e.state)}` : ""}
            {e.year !== null ? `, ${e.year}` : ""}
            {t(e.degree) ? ` (Degree code ${t(e.degree)})` : ""}
          </p>
        ))}
        {detail.education.rows.length === 0 && <p>No licence-record school on file.</p>}
        <p className="text-muted-foreground">{detail.education.message}</p>
      </Section>

      <Section title="Permits">
        {detail.permits.rows.length === 0 && <p>No permits.</p>}
        {personalPermits.length > 0 && (
          <div>
            <h3 className="mb-1 font-medium">Personal permits</h3>
            <ul className="list-disc space-y-1 pl-5">
              {personalPermits.map((p) => (
                <li key={p.id}>
                  {p.typeName ?? <NotLinked />}
                  {p.level ? ` · level ${p.level}` : ""}
                  {` · issued ${formatCentralDate(p.issueDate)}`}
                  {t(p.description) ? ` · ${t(p.description)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {officePermits.length > 0 && (
          <div>
            <h3 className="mb-1 font-medium">Office permits</h3>
            <ul className="list-disc space-y-1 pl-5">
              {officePermits.map((p) => (
                <li key={p.id}>
                  {p.typeName ?? <NotLinked />}
                  {p.level ? ` · level ${p.level}` : ""}
                  {` · issued ${formatCentralDate(p.issueDate)}`}
                  {" · "}
                  <PermitFirm row={p} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {detail.permits.truncated && <CutNote n={detail.permits.rows.length} />}
      </Section>

      <Section title="Affiliations">
        {detail.affiliations.rows.length === 0 && <p>No affiliations.</p>}
        {dentistOf.length > 0 && (
          <div>
            <h3 className="mb-1 font-medium">Affiliated individuals (this licensee is the dentist)</h3>
            <AffiliationList rows={dentistOf} />
          </div>
        )}
        {affiliatedTo.length > 0 && (
          <div>
            <h3 className="mb-1 font-medium">Affiliated to (this licensee is the affiliated individual)</h3>
            <AffiliationList rows={affiliatedTo} />
          </div>
        )}
        {detail.affiliations.truncated && <CutNote n={AFFILIATION_LIMIT} each />}
      </Section>

      <Section title="Offices">
        {detail.offices.rows.length === 0 && <p>No office affiliations.</p>}
        {detail.offices.rows.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {detail.offices.rows.map((o) => (
              <li key={o.id}>
                {o.officeId !== null ? (
                  <>
                    {t(o.officeName) ?? `Office ${o.officeId}`}
                    {t(o.officePhone) ? ` · ${t(o.officePhone)}` : ""}
                  </>
                ) : (
                  <NotLinked />
                )}
                {` · Office permit: ${o.officePermit === null ? "—" : o.officePermit ? "yes" : "no"}`}
              </li>
            ))}
          </ul>
        )}
        {detail.offices.truncated && <CutNote n={OFFICE_AFFILIATION_LIMIT} />}
      </Section>

      {detail.discipline !== "hidden" && (
        <Section title="Discipline">
          {!detail.discipline.linked ? (
            <p>
              <NotLinked detail={detail.discipline.reason} />
            </p>
          ) : detail.discipline.rows.length === 0 ? (
            <p>No discipline records are linked to this individual.</p>
          ) : (
            <ul className="space-y-2">
              {detail.discipline.rows.map((d, i) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <p>
                    {formatCentralDate(d.startDate)} to {formatCentralDate(d.endDate)} · Good standing:{" "}
                    {d.goodStanding === null ? "—" : d.goodStanding ? "yes" : "no"}
                  </p>
                  {t(d.notes) && <p className="mt-1 whitespace-pre-wrap">{t(d.notes)}</p>}
                </li>
              ))}
            </ul>
          )}
          {detail.discipline.linked && detail.discipline.truncated && <CutNote n={DISCIPLINE_LIMIT} />}
          <p className="text-muted-foreground">
            Discipline records without an individual link in the source do not appear on any licensee. Access
            remains the record until go-live.
          </p>
        </Section>
      )}
    </div>
  );
}
