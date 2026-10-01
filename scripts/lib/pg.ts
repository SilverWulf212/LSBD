// scripts/lib/pg.ts
//
// The one place sync / ops scripts get a Postgres connection (review I4, I2; rulings R39, R37):
// - TLS is fully verified against the pinned Supabase root CA (rejectUnauthorized: true).
//   ssl* parameters in the URL are stripped so they cannot override it.
// - Every session gets an application_name, a statement_timeout, a lock_timeout and an
//   idle_in_transaction_session_timeout, set with explicit SETs after connect (the session
//   pooler does not reliably forward startup parameters).

import { Client, type ClientConfig } from "pg";
import { PINNED_SSL, stripSslParams } from "../../src/lib/db/client-options";

export interface SessionTimeouts {
  statementTimeout: string;
  lockTimeout: string;
  idleInTransactionTimeout: string;
}

/** Defaults for every sync connection. The transform CALL (seconds today) fits well inside 10 min. */
export const SYNC_TIMEOUTS: SessionTimeouts = {
  statementTimeout: "10min",
  lockTimeout: "60s",
  idleInTransactionTimeout: "10min",
};

const DURATION = /^\d+(ms|s|min|h)?$/;
const APP_NAME = /^[A-Za-z0-9_.-]{1,63}$/;

export function scriptPgConfig(url: string, applicationName?: string): ClientConfig {
  return {
    connectionString: stripSslParams(url),
    ssl: { ...PINNED_SSL },
    ...(applicationName ? { application_name: applicationName } : {}),
  };
}

export function sessionSetupSql(applicationName: string, t: SessionTimeouts): string[] {
  if (!APP_NAME.test(applicationName)) throw new Error("invalid application_name");
  for (const v of [t.statementTimeout, t.lockTimeout, t.idleInTransactionTimeout]) {
    if (!DURATION.test(v)) throw new Error("invalid timeout value");
  }
  return [
    `SET application_name = '${applicationName}'`,
    `SET statement_timeout = '${t.statementTimeout}'`,
    `SET lock_timeout = '${t.lockTimeout}'`,
    `SET idle_in_transaction_session_timeout = '${t.idleInTransactionTimeout}'`,
  ];
}

export interface ConnectOptions {
  applicationName: string;
  timeouts?: Partial<SessionTimeouts>;
  /** Idle-connection errors; without a listener they would crash the process. */
  onError?: (e: Error) => void;
}

export async function connectPg(
  url: string,
  opts: ConnectOptions,
  factory: (cfg: ClientConfig) => Client = (cfg) => new Client(cfg),
): Promise<Client> {
  const c = factory(scriptPgConfig(url, opts.applicationName));
  c.on("error", opts.onError ?? (() => undefined));
  await c.connect();
  try {
    for (const sql of sessionSetupSql(opts.applicationName, { ...SYNC_TIMEOUTS, ...opts.timeouts })) await c.query(sql);
  } catch (e) {
    await c.end().catch(() => undefined);
    throw e;
  }
  return c;
}
