import React from "react";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { loadSyncStatus, RUN_LIMIT, type SyncRun } from "@/lib/sync-status";
import { formatCentralDateTime } from "@/lib/central-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Sync Status | Admin",
};

// Always read live bookkeeping; never cache.
export const dynamic = "force-dynamic";

// Server component only. lsbd_raw is REVOKEd from anon/authenticated, so it is
// read here through the privileged POSTGRES_URL connection and rendered to
// HTML; no lsbd_raw data is passed to a client component.
export default async function SyncStatusPage() {
  await requireAuth("admin");

  let status: Awaited<ReturnType<typeof loadSyncStatus>> | null = null;
  let loadError: string | null = null;
  try {
    status = await loadSyncStatus(async (text) => {
      const result = await db.execute(sql.raw(text));
      return result.rows as Record<string, unknown>[];
    });
  } catch (e) {
    console.error("sync status load failed", e);
    loadError = "Could not read sync bookkeeping from the database.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sync Status</h1>
        <p className="text-sm text-muted-foreground">
          MSSQL (LSBDSQL) → Supabase sync runs and per-table counts. All times are Central.
        </p>
      </div>

      {loadError && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {loadError}
        </div>
      )}

      {status?.stale && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-red-400 bg-red-600 p-4 text-white"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Sync is stale</p>
            <p className="text-sm">
              {status.latestOk
                ? `The last successful sync finished ${formatCentralDateTime(
                    status.latestOk.finishedAt ?? status.latestOk.startedAt
                  )} — more than 2 hours ago during business hours.`
                : "There is no successful sync run on record."}{" "}
              Check the LSBD-Sync scheduled tasks and the Windows event log on LSBDserver.
            </p>
          </div>
        </div>
      )}

      {status && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Last {RUN_LIMIT} runs
                {status.latestOk && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    Latest ok: {formatCentralDateTime(status.latestOk.startedAt)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status.runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sync runs recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Changed tables</TableHead>
                      <TableHead className="text-right">Ins</TableHead>
                      <TableHead className="text-right">Upd</TableHead>
                      <TableHead className="text-right">Del</TableHead>
                      <TableHead className="text-right">Orphans</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.runs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatCentralDateTime(r.startedAt)}
                        </TableCell>
                        <TableCell>{r.mode}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="max-w-xs whitespace-normal text-xs">
                          <RunTables run={r} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.inserted)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.updated)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.deleted)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.orphansSkipped)}</TableCell>
                        <TableCell className="max-w-sm whitespace-pre-wrap break-words text-xs text-red-800">
                          {r.error ?? ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tables ({status.tables.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {status.tables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tables tracked yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right">Source count</TableHead>
                      <TableHead className="text-right">Raw live count</TableHead>
                      <TableHead>Last changed</TableHead>
                      <TableHead>Last synced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.tables.map((t) => {
                      const mismatch =
                        t.sourceCount !== null &&
                        t.rawLiveCount !== null &&
                        t.sourceCount !== t.rawLiveCount;
                      return (
                        <TableRow key={t.tableName}>
                          <TableCell className="font-mono text-xs">{t.tableName}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(t.sourceCount)}</TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${mismatch ? "font-semibold text-amber-700" : ""}`}
                            title={mismatch ? "Differs from source count" : undefined}
                          >
                            {fmtNum(t.rawLiveCount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatCentralDateTime(t.lastChangedAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatCentralDateTime(t.lastSyncedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function fmtNum(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("en-US");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ok") return <Badge>ok</Badge>;
  if (status === "failed") return <Badge variant="destructive">failed</Badge>;
  if (status === "blocked")
    return (
      <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">
        blocked
      </Badge>
    );
  return <Badge variant="outline">{status}</Badge>;
}

function RunTables({ run }: { run: SyncRun }) {
  return (
    <div className="space-y-1">
      <div>{run.tablesChanged.length ? run.tablesChanged.join(", ") : "—"}</div>
      {run.blockedTables.length > 0 && (
        <div className="text-amber-800">Blocked: {run.blockedTables.join(", ")}</div>
      )}
      {run.schemaDrift.length > 0 && (
        <div className="text-amber-800">Schema drift: {run.schemaDrift.join(", ")}</div>
      )}
    </div>
  );
}
