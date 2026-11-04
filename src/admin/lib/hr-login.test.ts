import { describe, expect, it, vi, type Mock } from "vitest";
import {
  attemptHrLogin,
  classifyHrLoginError,
  HR_LOGIN_CREDENTIALS_MSG,
  HR_LOGIN_NETWORK_MSG,
  type HrLoginDeps,
} from "./hr-login";

function mockDeps(overrides: Partial<HrLoginDeps> = {}): HrLoginDeps {
  return {
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => undefined),
    hasHrLocalPassword: () => false,
    verifyHrLocalPassword: async () => false,
    writeHrLocalSession: vi.fn(),
    clearHrLocalSession: vi.fn(),
    ...overrides,
  };
}

function asMock(fn: unknown): Mock {
  return fn as Mock;
}

describe("classifyHrLoginError", () => {
  it("treats invalid-login Auth errors as credentials", () => {
    expect(classifyHrLoginError({ message: "Invalid login credentials", status: 400 })).toBe("credentials");
  });

  it("treats fetch / offline failures as network", () => {
    expect(classifyHrLoginError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyHrLoginError({ message: "Network error", status: 0 })).toBe("network");
    expect(classifyHrLoginError({ message: "timeout", status: 504 })).toBe("network");
  });
});

describe("attemptHrLogin", () => {
  it("success: cloud sign-in clears local session", async () => {
    const deps = mockDeps();
    const result = await attemptHrLogin("hr.compliance@gmail.com", "secret-ok", deps);
    expect(result).toEqual({ ok: true, mode: "cloud" });
    expect(asMock(deps.signInWithPassword)).toHaveBeenCalledOnce();
    expect(asMock(deps.clearHrLocalSession)).toHaveBeenCalledOnce();
    expect(asMock(deps.writeHrLocalSession)).not.toHaveBeenCalled();
    expect(asMock(deps.signOut)).not.toHaveBeenCalled();
  });

  it("wrong password: credentials error, no local session write", async () => {
    const deps = mockDeps({
      signInWithPassword: vi.fn(async () => ({
        error: { message: "Invalid login credentials", status: 400 },
      })),
    });
    const result = await attemptHrLogin("hr.compliance@gmail.com", "nope", deps);
    expect(result).toEqual({
      ok: false,
      kind: "credentials",
      message: HR_LOGIN_CREDENTIALS_MSG,
    });
    expect(asMock(deps.writeHrLocalSession)).not.toHaveBeenCalled();
    expect(asMock(deps.clearHrLocalSession)).not.toHaveBeenCalled();
  });

  it("network fail: distinct Try-again message", async () => {
    const deps = mockDeps({
      signInWithPassword: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    const result = await attemptHrLogin("hr.compliance@gmail.com", "secret-ok", deps);
    expect(result).toEqual({
      ok: false,
      kind: "network",
      message: HR_LOGIN_NETWORK_MSG,
    });
  });

  it("network fail via error object from signIn", async () => {
    const deps = mockDeps({
      signInWithPassword: vi.fn(async () => ({
        error: { message: "Failed to fetch", status: 0 },
      })),
    });
    const result = await attemptHrLogin("hr.compliance@gmail.com", "secret-ok", deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network");
      expect(result.message).toBe(HR_LOGIN_NETWORK_MSG);
    }
  });

  it("local fallback when cloud rejects but local hash matches", async () => {
    const deps = mockDeps({
      signInWithPassword: vi.fn(async () => ({
        error: { message: "Invalid login credentials", status: 400 },
      })),
      hasHrLocalPassword: () => true,
      verifyHrLocalPassword: async () => true,
    });
    const result = await attemptHrLogin("hr.compliance@gmail.com", "local-new", deps);
    expect(result).toEqual({ ok: true, mode: "local" });
    expect(asMock(deps.writeHrLocalSession)).toHaveBeenCalledWith("hr.compliance@gmail.com");
    expect(asMock(deps.signOut)).not.toHaveBeenCalled();
  });

  it("rejects stale cloud password when local hash does not match", async () => {
    const deps = mockDeps({
      signInWithPassword: vi.fn(async () => ({ error: null })),
      hasHrLocalPassword: () => true,
      verifyHrLocalPassword: async () => false,
    });
    const result = await attemptHrLogin("hr.compliance@gmail.com", "old-cloud", deps);
    expect(result).toEqual({
      ok: false,
      kind: "credentials",
      message: HR_LOGIN_CREDENTIALS_MSG,
    });
    expect(asMock(deps.signOut)).toHaveBeenCalledOnce();
    expect(asMock(deps.clearHrLocalSession)).not.toHaveBeenCalled();
  });

  it("double-click / overlapping: older failed request cannot overwrite newer success", async () => {
    let resolveFirst: (v: { error: null }) => void = () => undefined;
    const firstSignIn = new Promise<{ error: null }>((resolve) => {
      resolveFirst = resolve;
    });

    let generation = 0;

    const depsA = mockDeps({
      signInWithPassword: vi.fn(async () => firstSignIn),
      isStale: () => generation !== 1,
    });

    const depsB = mockDeps({
      signInWithPassword: vi.fn(async () => ({ error: null })),
      isStale: () => generation !== 2,
    });

    generation = 1;
    const pA = attemptHrLogin("hr.compliance@gmail.com", "secret-ok", depsA);

    generation = 2;
    const rB = await attemptHrLogin("hr.compliance@gmail.com", "secret-ok", depsB);
    expect(rB).toEqual({ ok: true, mode: "cloud" });

    resolveFirst({ error: null });
    const rA = await pA;
    expect(rA).toEqual({ ok: false, kind: "stale", message: "" });
    expect(asMock(depsA.clearHrLocalSession)).not.toHaveBeenCalled();
  });

  it("delayed response: stale flag after cloud success skips side effects", async () => {
    let stale = false;
    const deps = mockDeps({
      signInWithPassword: vi.fn(async () => {
        stale = true;
        return { error: null };
      }),
      isStale: () => stale,
    });
    const result = await attemptHrLogin("hr.compliance@gmail.com", "secret-ok", deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("stale");
    expect(asMock(deps.clearHrLocalSession)).not.toHaveBeenCalled();
  });

  it("empty password is credentials failure without calling auth", async () => {
    const deps = mockDeps();
    const result = await attemptHrLogin("hr.compliance@gmail.com", "", deps);
    expect(result).toEqual({
      ok: false,
      kind: "credentials",
      message: HR_LOGIN_CREDENTIALS_MSG,
    });
    expect(asMock(deps.signInWithPassword)).not.toHaveBeenCalled();
  });
});

describe("Login UI race contract (isolated)", () => {
  it("busyRef-style guard: second submit ignored while first in flight", async () => {
    let inFlight = false;
    let attempts = 0;
    const run = async () => {
      if (inFlight) return "ignored";
      inFlight = true;
      attempts += 1;
      await new Promise((r) => setTimeout(r, 5));
      inFlight = false;
      return "ran";
    };
    const [a, b] = await Promise.all([run(), run()]);
    expect([a, b].sort()).toEqual(["ignored", "ran"]);
    expect(attempts).toBe(1);
  });

  it("clearing error on new attempt: only latest failure message kept", async () => {
    let attempt = 0;
    let err = "old";
    const start = () => {
      const id = ++attempt;
      err = "";
      return async (message: string) => {
        if (id !== attempt) return;
        err = message;
      };
    };
    const finish1 = start();
    const finish2 = start();
    await finish1(HR_LOGIN_CREDENTIALS_MSG);
    await finish2(HR_LOGIN_NETWORK_MSG);
    expect(err).toBe(HR_LOGIN_NETWORK_MSG);
  });
});
