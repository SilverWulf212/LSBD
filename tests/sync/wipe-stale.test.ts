import { describe, it, expect } from "vitest";
import { wipeGate, CONFIRM_FLAG } from "../../scripts/ops/wipe-stale";

// M11 (ruling R42): wipe-stale TRUNCATEs every lsbd table and churns app ids. It needs an
// explicit acknowledgement flag, and it refuses outright once the sync has ever run
// (lsbd_raw._sync_runs has rows), i.e. against the production-to-be project.

describe("wipeGate", () => {
  it("refuses without --i-understand-this-wipes, before anything else", () => {
    expect(CONFIRM_FLAG).toBe("--i-understand-this-wipes");
    expect(wipeGate({ argv: [], syncRuns: null })).toMatch(/--i-understand-this-wipes/);
    expect(wipeGate({ argv: ["--yes"], syncRuns: 0 })).toMatch(/--i-understand-this-wipes/);
  });

  it("refuses when lsbd_raw._sync_runs has any rows (the sync is live)", () => {
    expect(wipeGate({ argv: [CONFIRM_FLAG, "--yes"], syncRuns: 1 })).toMatch(/_sync_runs/);
    expect(wipeGate({ argv: [CONFIRM_FLAG], syncRuns: 4321 })).toMatch(/_sync_runs/);
  });

  it("allows only with the flag and an empty (or absent) run history", () => {
    expect(wipeGate({ argv: [CONFIRM_FLAG, "--yes"], syncRuns: 0 })).toBeNull();
    expect(wipeGate({ argv: [CONFIRM_FLAG], syncRuns: null })).toBeNull();
  });
});
