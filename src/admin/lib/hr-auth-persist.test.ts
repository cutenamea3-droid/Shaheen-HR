import { describe, expect, it, vi } from "vitest";
import {
  clearHrAuthPersistArtifacts,
  ensureHrAuthPersisted,
  readHrAuthSessionBackup,
  readHrCloudEmailHint,
  recoverHrAuthSession,
  resolveHrReconnectEmail,
  writeHrAuthSessionBackup,
  writeHrCloudEmailHint,
} from "./hr-auth-persist";

function memStore(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

const sample = {
  access_token: "at-1",
  refresh_token: "rt-1",
  expires_at: 9999999999,
  token_type: "bearer",
  user: { id: "uid-1", email: "hr.compliance@gmail.com" },
};

describe("hr-auth-persist", () => {
  it("dual-writes session backup + cloud email hint", () => {
    const store = memStore();
    expect(writeHrAuthSessionBackup(sample, store)).toBe(true);
    expect(readHrAuthSessionBackup(store)?.access_token).toBe("at-1");
    expect(readHrCloudEmailHint(store)).toBe("hr.compliance@gmail.com");
  });

  it("ensureHrAuthPersisted calls setSession and re-backs up", async () => {
    const store = memStore();
    const setSession = vi.fn(async () => ({ error: null }));
    const result = await ensureHrAuthPersisted(sample, {
      setSession,
      store,
      persistStorage: async () => true,
    });
    expect(result).toEqual({ ok: true, backedUp: true });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "at-1",
      refresh_token: "rt-1",
    });
    expect(readHrAuthSessionBackup(store)?.refresh_token).toBe("rt-1");
  });

  it("recoverHrAuthSession prefers live getSession, then backup setSession", async () => {
    const store = memStore();
    writeHrAuthSessionBackup(sample, store);

    const fromBackup = await recoverHrAuthSession(
      {
        getSession: vi
          .fn()
          .mockResolvedValueOnce({ data: { session: null } })
          .mockResolvedValueOnce({ data: { session: null } }),
        setSession: vi.fn(async () => ({ data: { session: sample }, error: null })),
        refreshSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
      { store, delayMs: 0, sleep: async () => undefined },
    );
    expect(fromBackup?.access_token).toBe("at-1");
  });

  it("recoverHrAuthSession returns existing session without touching backup path", async () => {
    const store = memStore();
    const setSession = vi.fn();
    const session = await recoverHrAuthSession(
      {
        getSession: vi.fn(async () => ({ data: { session: sample } })),
        setSession,
        refreshSession: vi.fn(),
        getUser: vi.fn(),
      },
      { store, delayMs: 0, sleep: async () => undefined },
    );
    expect(session?.user?.id).toBe("uid-1");
    expect(setSession).not.toHaveBeenCalled();
    expect(readHrCloudEmailHint(store)).toBe("hr.compliance@gmail.com");
  });

  it("resolveHrReconnectEmail prefers local session, then cloud hint, then fallback", () => {
    expect(
      resolveHrReconnectEmail({
        localSessionEmail: "local@x.com",
        cloudHintEmail: "hint@x.com",
        fallbackEmail: "hr.compliance@gmail.com",
      }),
    ).toBe("local@x.com");
    expect(
      resolveHrReconnectEmail({
        localSessionEmail: null,
        cloudHintEmail: "hint@x.com",
        fallbackEmail: "hr.compliance@gmail.com",
      }),
    ).toBe("hint@x.com");
    expect(
      resolveHrReconnectEmail({
        localSessionEmail: null,
        cloudHintEmail: null,
        fallbackEmail: "hr.compliance@gmail.com",
      }),
    ).toBe("hr.compliance@gmail.com");
  });

  it("clearHrAuthPersistArtifacts removes backup and hint", () => {
    const store = memStore();
    writeHrAuthSessionBackup(sample, store);
    writeHrCloudEmailHint("hr.compliance@gmail.com", store);
    clearHrAuthPersistArtifacts(store);
    expect(readHrAuthSessionBackup(store)).toBeNull();
    expect(readHrCloudEmailHint(store)).toBeNull();
  });
});
