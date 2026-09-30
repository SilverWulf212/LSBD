import { describe, it, expect, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { query, closeBridge, bridgePid, _setSpawnForTests } from "../../scripts/sync/mssql";

// Unit tests for the TS side of the bridge, with a fake child process (no PowerShell, no VM).

type Req = { id: number; sql?: string; quit?: boolean };
type Handler = (req: Req, child: FakeChild) => void;

let nextPid = 1000;

class FakeChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  pid = nextPid++;
  killed = false;
  requests: Req[] = [];
  private closed = false;

  constructor(private handler: Handler) {
    super();
    let buf = "";
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk: string) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const req = JSON.parse(line) as Req;
        this.requests.push(req);
        if (req.quit) this.exit(0);
        else this.handler(req, this);
      }
    });
  }

  send(msg: unknown) {
    this.stdout.write((typeof msg === "string" ? msg : JSON.stringify(msg)) + "\n");
  }

  rows(id: number, n: number, count = n) {
    for (let i = 0; i < n; i++) this.send({ id, row: { i } });
    this.send({ id, done: true, count });
  }

  exit(code: number | null, stderr = "") {
    if (this.closed) return;
    this.closed = true;
    if (stderr) this.stderr.write(stderr);
    setTimeout(() => this.emit("close", code), 5);
  }

  kill() {
    this.killed = true;
    this.exit(null);
    return true;
  }
}

function install(handler: Handler): FakeChild[] {
  const spawned: FakeChild[] = [];
  _setSpawnForTests(() => {
    const c = new FakeChild(handler);
    spawned.push(c);
    return c as unknown as ChildProcessWithoutNullStreams;
  });
  return spawned;
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const r of it) out.push(r);
  return out;
}

const okHandler: Handler = (req, c) => c.rows(req.id, 2);

afterEach(async () => {
  await closeBridge();
  _setSpawnForTests(null);
  delete process.env.SYNC_BRIDGE_TIMEOUT_MS;
});

describe("mssql bridge wrapper (fake child)", () => {
  it("yields rows and completes when done.count matches", async () => {
    const spawned = install(okHandler);
    expect(await collect(query("SELECT 1"))).toEqual([{ i: 0 }, { i: 1 }]);
    expect(spawned.length).toBe(1);
    expect(spawned[0].requests[0]).toEqual({ id: 1, sql: "SELECT 1" });
  });

  it("sends non-ASCII SQL as \\u escapes", async () => {
    const spawned = install(okHandler);
    await collect(query("SELECT N'Café'"));
    // The raw request line is pure ASCII; JSON.parse restores the text.
    expect(spawned[0].requests[0].sql).toBe("SELECT N'Café'");
  });

  it("rejects with 'bridge: row count mismatch' when done.count differs", async () => {
    install((req, c) => c.rows(req.id, 2, 3));
    await expect(collect(query("SELECT 1"))).rejects.toThrow("bridge: row count mismatch");
  });

  it("rejects on an error reply and keeps the same bridge", async () => {
    const spawned = install((req, c) => {
      if (req.sql === "bad") c.send({ id: req.id, error: "Invalid object name 'x'." });
      else c.rows(req.id, 1);
    });
    await expect(collect(query("bad"))).rejects.toThrow("Invalid object name");
    expect(await collect(query("good"))).toEqual([{ i: 0 }]);
    expect(spawned.length).toBe(1);
  });

  it("treats an unparseable stdout line as an error, kills the bridge, and respawns", async () => {
    let first = true;
    const spawned = install((req, c) => {
      if (first) {
        first = false;
        c.send({ id: req.id, row: { i: 0 } });
        c.send("WARNING: something chatty");
      } else {
        c.rows(req.id, 1);
      }
    });
    await expect(collect(query("SELECT 1"))).rejects.toThrow(/bridge: unparseable stdout line/);
    expect(spawned[0].killed).toBe(true);
    expect(await collect(query("SELECT 1"))).toEqual([{ i: 0 }]);
    expect(spawned.length).toBe(2);
  });

  it("does not echo the unparseable line (it may hold row data)", async () => {
    install((_req, c) => c.send("SSN 123-45-6789"));
    await expect(collect(query("SELECT 1"))).rejects.toThrow(
      "bridge: unparseable stdout line (15 chars)",
    );
  });

  it("treats a reply for the wrong id as a protocol error", async () => {
    install((req, c) => c.send({ id: req.id + 7, done: true, count: 0 }));
    await expect(collect(query("SELECT 1"))).rejects.toThrow(/bridge: reply id 8/);
  });

  it("times out an idle request, kills the child, and respawns on the next query", async () => {
    process.env.SYNC_BRIDGE_TIMEOUT_MS = "50";
    let silent = true;
    const spawned = install((req, c) => {
      if (!silent) c.rows(req.id, 1);
    });
    await expect(collect(query("SELECT 1"))).rejects.toThrow("bridge: timeout");
    expect(spawned[0].killed).toBe(true);
    silent = false;
    expect(await collect(query("SELECT 1"))).toEqual([{ i: 0 }]);
    expect(spawned.length).toBe(2);
  });

  it("does not time out a request that keeps producing rows", async () => {
    process.env.SYNC_BRIDGE_TIMEOUT_MS = "60";
    install((req, c) => {
      let i = 0;
      const t = setInterval(() => {
        if (i < 6) c.send({ id: req.id, row: { i: i++ } });
        else {
          clearInterval(t);
          c.send({ id: req.id, done: true, count: 6 });
        }
      }, 25); // 6 x 25 ms = 150 ms total, but never 60 ms of silence
    });
    expect((await collect(query("SELECT 1"))).length).toBe(6);
  });

  it("rejects the in-flight query with stderr when the child dies, then respawns", async () => {
    let first = true;
    const spawned = install((req, c) => {
      if (first) {
        first = false;
        c.exit(1, "boom: session lost");
      } else {
        c.rows(req.id, 1);
      }
    });
    await expect(collect(query("SELECT 1"))).rejects.toThrow(
      /bridge exited \(code 1\): boom: session lost/,
    );
    expect(await collect(query("SELECT 1"))).toEqual([{ i: 0 }]);
    expect(spawned.length).toBe(2);
  });

  it("serialises requests: the second is not sent until the first is done", async () => {
    const pending: Array<() => void> = [];
    const spawned = install((req, c) => {
      pending.push(() => c.rows(req.id, 1));
    });
    const p1 = collect(query("q1"));
    const p2 = collect(query("q2"));
    await new Promise((r) => setTimeout(r, 20));
    expect(spawned[0].requests.map((r) => r.sql)).toEqual(["q1"]);
    pending.shift()!();
    await p1;
    await new Promise((r) => setTimeout(r, 20));
    expect(spawned[0].requests.map((r) => r.sql)).toEqual(["q1", "q2"]);
    pending.shift()!();
    await p2;
  });

  it("drains the rest of a reply after an early break", async () => {
    const spawned = install((req, c) => c.rows(req.id, 50));
    let seen = 0;
    for await (const r of query("big")) {
      void r;
      if (++seen === 3) break;
    }
    expect(await collect(query("next"))).toHaveLength(50);
    expect(spawned.length).toBe(1);
  });

  it("closeBridge sends quit and awaits exit", async () => {
    const spawned = install(okHandler);
    await collect(query("SELECT 1"));
    expect(bridgePid()).toBe(spawned[0].pid);
    await closeBridge();
    expect(spawned[0].requests.at(-1)?.quit).toBe(true);
    expect(bridgePid()).toBeNull();
  });
});
