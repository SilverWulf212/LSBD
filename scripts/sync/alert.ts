// scripts/sync/alert.ts
//
// The one alert path for the sync runner and reconcile (review I2, ruling R37):
//   ok()        -> GET <SYNC_HEALTHCHECK_URL>            (dead-man's switch: absence of pings alerts)
//   fail(msg)   -> GET <SYNC_HEALTHCHECK_URL>/fail  AND  Application event log, source LSBD-Sync
// Both are best-effort and never throw. The event-log message travels in the environment, never
// on the command line (no injection). Callers pass redacted text only.

import { spawnSync as nodeSpawnSync } from "node:child_process";
import { loadSecrets } from "../lib/secrets";

export interface Alerter {
  ok(): Promise<void>;
  fail(message: string): Promise<void>;
}

export interface AlertDeps {
  healthcheckUrl?: () => string | undefined;
  fetch?: typeof fetch;
  spawnSync?: typeof nodeSpawnSync;
  log?: (s: string) => void;
  /** Event id: 1001 sync runner, 1002 reconcile. */
  eventId?: number;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function defaultHealthcheckUrl(): string | undefined {
  const env = process.env.SYNC_HEALTHCHECK_URL;
  if (env) return env;
  try {
    return loadSecrets()["SYNC_HEALTHCHECK_URL"] || undefined;
  } catch {
    return undefined;
  }
}

/** The best-effort event-log call. The message travels in the environment, never in the command. */
export function eventLogInvocation(
  message: string,
  eventId = 1001,
): { file: string; args: string[]; env: NodeJS.ProcessEnv } {
  if (!Number.isInteger(eventId) || eventId < 1 || eventId > 65535) throw new Error("invalid event id");
  return {
    file: "powershell.exe",
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Write-EventLog -LogName Application -Source LSBD-Sync -EventId ${eventId} -EntryType Error -Message $env:LSBD_SYNC_MSG`,
    ],
    env: { ...process.env, LSBD_SYNC_MSG: message },
  };
}

export function makeAlerter(deps: AlertDeps = {}): Alerter {
  const urlOf = deps.healthcheckUrl ?? defaultHealthcheckUrl;
  const doFetch = deps.fetch ?? fetch;
  const spawn = deps.spawnSync ?? nodeSpawnSync;
  const log = deps.log ?? ((s: string) => console.error(s));

  async function ping(ok: boolean): Promise<void> {
    let url: string | undefined;
    try {
      url = urlOf();
    } catch {
      url = undefined;
    }
    if (!url) return;
    const target = ok ? url : `${url.replace(/\/+$/, "")}/fail`;
    try {
      await doFetch(target, { method: "GET", signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      log(`healthcheck ping failed: ${errMsg(e)}`);
    }
  }

  function eventLog(message: string): void {
    try {
      const inv = eventLogInvocation(message.slice(0, 4000), deps.eventId ?? 1001);
      const r = spawn(inv.file, inv.args, { env: inv.env, windowsHide: true, timeout: 30_000, encoding: "utf8" });
      if (r.status !== 0) log("event log write failed (is the LSBD-Sync source registered?)");
    } catch (e) {
      log(`event log write failed: ${errMsg(e)}`);
    }
  }

  return {
    ok: () => ping(true),
    async fail(message: string) {
      eventLog(message);
      await ping(false);
    },
  };
}
