import { describe, it, expect } from "vitest";
import { pkProbeSql, fingerprintSql, keysSql } from "../../scripts/sync/sql-gen";
import { confirmAbsent, runSync } from "../../scripts/sync/run";
import type { SourceTable } from "../../scripts/sync/types";
import type { Alerter } from "../../scripts/sync/alert";

// R38 (review I3): an unordered NOLOCK key scan can miss a row that moves during a page split.
// Before soft-deleting, every delete candidate is re-checked with a PK point lookup through the
// same read-only bridge; only keys the lookup confirms absent are deleted.

const col = (name: string, type: string, ordinal: number) => ({
  name,
  type,
  maxLength: 0,
  precision: 0,
  scale: 0,
  nullable: ordinal !== 1,
  ordinal,
});
const T: SourceTable = { name: "T", pk: "ID", rowCount: 3, columns: [col("ID", "int", 1), col("Name", "nvarchar", 2)] };
const S: SourceTable = { name: "S", pk: "Code", rowCount: 0, columns: [col("Code", "nvarchar", 1)] };

describe("pkProbeSql", () => {
  it("is a SELECT of the PK by IN-list, without NOLOCK and without the row hash", () => {
    expect(pkProbeSql(T, ["2", "3"])).toBe("SELECT [ID] AS k FROM dbo.[T] WHERE [ID] IN (2, 3)");
    expect(pkProbeSql(S, ["O'B"])).toBe("SELECT [Code] AS k FROM dbo.[S] WHERE [Code] IN (N'O''B')");
  });
  it("validates keys like rowsSql", () => {
    expect(() => pkProbeSql(T, ["1; DROP"])).toThrow("Invalid integer key");
    expect(() => pkProbeSql(T, [])).toThrow();
  });
});

describe("confirmAbsent", () => {
  it("returns only the candidates the point lookup does not find", async () => {
    const seen: string[] = [];
    const q = (async function* (sql: string) {
      seen.push(sql);
      if (sql === pkProbeSql(T, ["1", "2", "3"])) yield { k: 2 };
    }) as never;
    expect(await confirmAbsent(q, T, ["1", "2", "3"])).toEqual(["1", "3"]);
    expect(seen).toEqual([pkProbeSql(T, ["1", "2", "3"])]);
  });
  it("chunks large candidate lists", async () => {
    const sqls: string[] = [];
    const q = (async function* (sql: string) {
      sqls.push(sql);
    }) as never;
    const keys = Array.from({ length: 2500 }, (_, i) => String(i + 1));
    expect(await confirmAbsent(q, T, keys)).toEqual(keys);
    expect(sqls).toHaveLength(3);
  });
  it("normalises returned keys (uniqueidentifier case)", async () => {
    const G: SourceTable = { name: "G", pk: "U", rowCount: 0, columns: [col("U", "uniqueidentifier", 1)] };
    const q = (async function* () {
      yield { k: "ABCDEF00-0000-0000-0000-00000000000A" };
    }) as never;
    expect(await confirmAbsent(q, G, ["abcdef00-0000-0000-0000-00000000000a"])).toEqual([]);
  });
});

describe("runSync soft-delete re-probe (fake source + fake pg)", () => {
  it("a key the scan missed but the lookup finds is kept; a truly absent key is deleted", async () => {
    // raw holds 1, 2, 3. The NOLOCK key scan returns only 1 (it "missed" 2; 3 is really gone).
    const source = (async function* (sql: string) {
      if (sql === fingerprintSql([T])) yield { t: "T", n: 2, fp: 1 };
      else if (sql === keysSql(T)) yield { k: 1, h: "h1" };
      else if (sql === pkProbeSql(T, ["2", "3"])) yield { k: 2 };
      else throw new Error(`unexpected source SQL: ${sql.slice(0, 60)}`);
    }) as never;

    const deletes: unknown[] = [];
    const pg = {
      async query(sql: string, params?: unknown[]) {
        const rows = (r: unknown[]) => ({ rows: r, rowCount: r.length });
        if (/pg_try_advisory_lock/.test(sql)) return rows([{ got: true }]);
        if (/INSERT INTO lsbd_raw._sync_runs/.test(sql)) return rows([{ id: "9" }]);
        if (/information_schema\.columns/.test(sql))
          return rows(
            [
              ["ID", "integer"],
              ["Name", "text"],
              ["_row_hash", "text"],
              ["_synced_at", "timestamp with time zone"],
              ["_deleted_at", "timestamp with time zone"],
            ].map(([column_name, data_type]) => ({ table_name: "T", column_name, data_type })),
          );
        if (/SELECT "ID"::text AS k/.test(sql))
          return rows([
            { k: "1", h: "h1" },
            { k: "2", h: "h2" },
            { k: "3", h: "h3" },
          ]);
        if (/UPDATE lsbd_raw\."T" SET _deleted_at/.test(sql)) {
          deletes.push(...(params![0] as unknown[]));
          return rows(params![0] as unknown[]);
        }
        if (/SELECT count\(\*\) AS n FROM lsbd_raw\."T"/.test(sql)) return rows([{ n: "2" }]);
        return rows([]);
      },
      async end() {},
      on() {
        return pg;
      },
    };
    const alert: Alerter = { ok: async () => undefined, fail: async () => undefined };

    const s = await runSync(
      { mode: "full", tables: ["T"], transform: false, allowMassDelete: false },
      { readSchema: async () => [T], query: source, db: async () => pg as never, alert, hmacKey: Buffer.alloc(32, 1) },
    );
    expect(s.status).toBe("ok");
    expect(deletes).toEqual(["3"]); // 2 was re-confirmed present at source
    expect(s.deleted).toBe(1);
  });
});
