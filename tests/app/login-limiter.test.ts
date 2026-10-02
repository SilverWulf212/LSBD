import { describe, expect, it } from "vitest";
import {
  DUMMY_BCRYPT_HASH,
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

describe("verifyCredentials", () => {
  it("returns the user on a correct password and clears the email key", async () => {
    const { deps, rows } = setup();
    rows.set("email:erin@lsbd.org", [new Date("2026-10-02T11:59:00Z")]);
    const r = await verifyCredentials(attempt("Erin@LSBD.org", "good"), deps);
    expect(r).toEqual({ id: "6", email: "erin@lsbd.org", name: "Erin", role: "admin" });
    expect(rows.has("email:erin@lsbd.org")).toBe(false);
  });

  it("records one failure under both keys on a wrong password", async () => {
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

  it("locks an email after the per-email limit without calling compare", async () => {
    const { deps, compared } = setup();
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) {
      await verifyCredentials(attempt("erin@lsbd.org", "bad", `9.9.9.${i}`), deps);
    }
    compared.length = 0;
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good", "8.8.8.8"), deps)).toBeNull();
    expect(compared).toHaveLength(0);
  });

  it("locks an ip after the per-ip limit across different emails", async () => {
    const { deps, compared } = setup();
    for (let i = 0; i < LOGIN_LIMITS.perIp; i++) {
      await verifyCredentials(attempt(`user${i}@lsbd.org`, "bad"), deps);
    }
    compared.length = 0;
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).toBeNull();
    expect(compared).toHaveLength(0);
  });

  it("ignores failures older than the window", async () => {
    const { deps, clock } = setup();
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) {
      await verifyCredentials(attempt("erin@lsbd.org", "bad", `9.9.9.${i}`), deps);
    }
    clock.t = new Date(clock.t.getTime() + LOGIN_LIMITS.windowMs + 1000);
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).not.toBeNull();
  });

  it("fails closed when the store cannot count", async () => {
    const { deps, compared } = setup();
    deps.store = { ...deps.store, countSince: async () => { throw new Error("db down"); } };
    expect(await verifyCredentials(attempt("erin@lsbd.org", "good"), deps)).toBeNull();
    expect(compared).toHaveLength(0);
  });

  it("does not throw when recording a failure fails", async () => {
    const { deps } = setup();
    deps.store = { ...deps.store, record: async () => { throw new Error("db down"); } };
    expect(await verifyCredentials(attempt("erin@lsbd.org", "bad"), deps)).toBeNull();
  });

  it("rejects malformed input without looking the user up", async () => {
    let looked = 0;
    const { deps } = setup({ async findUser() { looked++; return USER; } });
    expect(await verifyCredentials(attempt(42, "good"), deps)).toBeNull();
    expect(await verifyCredentials(attempt(`${"a".repeat(250)}@lsbd.org`, "good"), deps)).toBeNull();
    expect(await verifyCredentials(attempt("erin@lsbd.org", "x".repeat(201)), deps)).toBeNull();
    expect(await verifyCredentials(attempt("erin@lsbd.org", ""), deps)).toBeNull();
    expect(looked).toBe(0);
  });
});
