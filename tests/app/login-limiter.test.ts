import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DUMMY_BCRYPT_HASH,
  limiterErrorTag,
  LOGIN_LIMITS,
  loginKeys,
  verifyCredentials,
  type AttemptStore,
  type LoginDeps,
  type LoginUser,
} from "../../src/lib/login-limiter";

const USER: LoginUser = {
  id: 6,
  email: "erin@lsbd.org",
  name: "Erin",
  role: "admin",
  passwordHash: "hash-of-good",
};

function fakeStore(now: () => Date = () => new Date()) {
  const rows = new Map<string, Date[]>();
  const store: AttemptStore = {
    async countSince(key, since) {
      return (rows.get(key) ?? []).filter((d) => d >= since).length;
    },
    async record(key) {
      rows.set(key, [...(rows.get(key) ?? []), now()]);
    },
    async clear(key) {
      rows.delete(key);
    },
  };
  return { store, rows };
}

function setup(over: Partial<LoginDeps> = {}) {
  const clock = { t: new Date("2026-10-02T12:00:00Z") };
  const now = () => clock.t;
  const { store, rows } = fakeStore(now);
  const compared: string[] = [];
  const deps: LoginDeps = {
    store,
    now,
    async findUser(email) {
      return email === USER.email ? USER : undefined;
    },
    async compare(password, hash) {
      compared.push(hash);
      return password === "good" && hash === USER.passwordHash;
    },
    ...over,
  };
  return { deps, rows, compared, clock };
}

const attempt = (email: unknown, password: unknown, ip = "1.2.3.4") => ({ email, password, ip });

describe("loginKeys", () => {
  it("normalises ip and email", () => {
    expect(loginKeys("1.2.3.4", " Erin@LSBD.org ")).toEqual({
      ip: "ip:1.2.3.4",
      email: "email:erin@lsbd.org",
    });
  });
});

afterEach(() => vi.restoreAllMocks());

describe("verifyCredentials", () => {
  it("returns the user on a correct password and clears the email key", async () => {
    const { deps, rows } = setup();
    rows.set("email:erin@lsbd.org", [new Date("2026-10-02T11:59:00Z")]);
    const r = await verifyCredentials(attempt("Erin@LSBD.org", "good"), deps);
    expect(r).toEqual({ id: "6", email: "erin@lsbd.org", name: "Erin", role: "admin" });
    expect(rows.has("email:erin@lsbd.org")).toBe(false);
  });

  it("keeps the ip attempt of a successful sign-in counted", async () => {
    const { deps, rows } = setup();
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).not.toBeNull();
    expect(rows.has("email:erin@lsbd.org")).toBe(false);
    expect(rows.get("ip:1.2.3.4")).toHaveLength(1);
  });

  it("records the attempt under both keys on a wrong password", async () => {
    const { deps, rows } = setup();
    expect(await verifyCredentials(attempt("erin@lsbd.org", "bad"), deps)).toBeNull();
    expect(rows.get("ip:1.2.3.4")).toHaveLength(1);
    expect(rows.get("email:erin@lsbd.org")).toHaveLength(1);
  });

  it("compares against the dummy hash for an unknown email", async () => {
    const { deps, rows, compared } = setup();
    expect(await verifyCredentials(attempt("nobody@lsbd.org", "good"), deps)).toBeNull();
    expect(compared).toEqual([DUMMY_BCRYPT_HASH]);
    expect(rows.get("ip:1.2.3.4")).toHaveLength(1);
    expect(rows.get("email:nobody@lsbd.org")).toHaveLength(1);
  });

  it("evaluates the 5th attempt for an email and blocks the 6th without calling compare", async () => {
    const { deps, compared } = setup();
    for (let i = 0; i < LOGIN_LIMITS.perEmail - 1; i++) {
      await verifyCredentials(attempt("erin@lsbd.org", "bad", `9.9.9.${i}`), deps);
    }
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good", "8.8.8.8"), deps)).not.toBeNull();

    const second = setup();
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) {
      await verifyCredentials(attempt("erin@lsbd.org", "bad", `9.9.9.${i}`), second.deps);
    }
    second.compared.length = 0;
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good", "8.8.8.8"), second.deps)).toBeNull();
    expect(second.compared).toHaveLength(0);
    expect(compared.length).toBe(LOGIN_LIMITS.perEmail);
  });

  it("evaluates the 10th attempt from an ip and blocks the 11th without calling compare", async () => {
    const { deps, compared } = setup();
    for (let i = 0; i < LOGIN_LIMITS.perIp - 1; i++) {
      await verifyCredentials(attempt(`user${i}@lsbd.org`, "bad"), deps);
    }
    compared.length = 0;
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).not.toBeNull();
    expect(compared).toHaveLength(1);

    const second = setup();
    for (let i = 0; i < LOGIN_LIMITS.perIp; i++) {
      await verifyCredentials(attempt(`user${i}@lsbd.org`, "bad"), second.deps);
    }
    second.compared.length = 0;
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), second.deps)).toBeNull();
    expect(second.compared).toHaveLength(0);
  });

  it("calls compare at most perEmail times for 20 parallel wrong-password attempts", async () => {
    const { deps, compared } = setup();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => verifyCredentials(attempt("erin@lsbd.org", "bad", `7.7.7.${i}`), deps))
    );
    expect(results.every((r) => r === null)).toBe(true);
    expect(compared.length).toBeLessThanOrEqual(LOGIN_LIMITS.perEmail);
  });

  it("ignores attempts older than the window", async () => {
    const { deps, clock } = setup();
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) {
      await verifyCredentials(attempt("erin@lsbd.org", "bad", `9.9.9.${i}`), deps);
    }
    clock.t = new Date(clock.t.getTime() + LOGIN_LIMITS.windowMs + 1000);
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).not.toBeNull();
  });

  it("fails closed and logs when record fails, even with the correct password", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, compared } = setup();
    deps.store = { ...deps.store, record: async () => { throw new Error("db down"); } };
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).toBeNull();
    expect(compared).toHaveLength(0);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0]).toEqual(["login limiter unavailable:", "Error"]);
    expect(JSON.stringify(err.mock.calls)).not.toMatch(/erin@lsbd\.org|good/);
  });

  it("logs only the error class and code, never the key, query or password", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const real = Object.assign(new Error("Failed query: insert ... params: email:erin@lsbd.org"), {
      name: "DrizzleQueryError",
      cause: Object.assign(new Error("relation does not exist"), { code: "42P01" }),
    });
    const { deps } = setup();
    deps.store = { ...deps.store, record: async () => { throw real; } };
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).toBeNull();
    const logged = err.mock.calls.flat().join(" ");
    expect(logged).toContain("DrizzleQueryError 42P01");
    expect(logged).not.toContain("erin@lsbd.org");
    expect(logged).not.toContain("params");
    expect(logged).not.toContain("good");
  });

  it("limiterErrorTag handles odd inputs", () => {
    expect(limiterErrorTag(new Error("x"))).toBe("Error");
    expect(limiterErrorTag("boom")).toBe("unknown");
    expect(limiterErrorTag(null)).toBe("unknown");
    expect(limiterErrorTag(Object.assign(new Error("m"), { code: "ECONNRESET" }))).toBe("Error ECONNRESET");
  });

  it("fails closed when the store cannot count", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, compared } = setup();
    deps.store = { ...deps.store, countSince: async () => { throw new Error("db down"); } };
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).toBeNull();
    expect(compared).toHaveLength(0);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("still returns the user, and logs, when clearing the email key fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup();
    deps.store = { ...deps.store, clear: async () => { throw new Error("db down"); } };
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).not.toBeNull();
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0]).toEqual(["login limiter clear failed:", "Error"]);
    expect(JSON.stringify(err.mock.calls)).not.toMatch(/erin@lsbd\.org|good/);
  });

  it("rejects malformed input without recording or looking the user up", async () => {
    let looked = 0;
    const { deps, rows } = setup({ async findUser() { looked++; return USER; } });
    expect(await verifyCredentials(attempt(42, "good"), deps)).toBeNull();
    expect(await verifyCredentials(attempt(`${"a".repeat(250)}@lsbd.org`, "good"), deps)).toBeNull();
    expect(await verifyCredentials(attempt("erin@lsbd.org", "x".repeat(201)), deps)).toBeNull();
    expect(await verifyCredentials(attempt("erin@lsbd.org", ""), deps)).toBeNull();
    expect(looked).toBe(0);
    expect(rows.size).toBe(0);
  });
});
