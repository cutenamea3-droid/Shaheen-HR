import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { LoginGate } from "@/dispatch/components/LoginGate";
import { UserAdmin } from "@/dispatch/components/UserAdmin";
import { getDispatchAccount, isDispatchPreviewMode, signOutDispatch } from "@/dispatch/lib/auth";
import type { DispatchAccount } from "@/dispatch/lib/types";

/**
 * Batch 2 Dispatch shell / landing only.
 * Full loads, check-calls, and shift handover remain on PR #25 — do not expand ops here.
 */
export function DispatchApp() {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<DispatchAccount | null>(null);

  useEffect(() => {
    let alive = true;
    void getDispatchAccount()
      .then((a) => {
        if (alive) setAccount(a);
      })
      .catch(() => {
        if (alive) setAccount(null);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    return <div className="p-10 text-sm text-[color:var(--dispatch-muted)]">Loading Dispatch…</div>;
  }

  if (!account) {
    return <LoginGate onSignedIn={setAccount} />;
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-44px)] max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--dispatch-orange)]">
            Dispatch Operations
          </p>
          <h1 className="font-display text-3xl font-bold text-[color:var(--dispatch-navy)]">Desk landing</h1>
          <p className="mt-1 text-sm text-[color:var(--dispatch-muted)]">
            Signed in as {account.display_name} · {account.role}
            {isDispatchPreviewMode() ? " · preview/fixtures" : ""}
          </p>
        </div>
        <button
          type="button"
          className="dispatch-btn-ghost"
          onClick={() => {
            void signOutDispatch().then(() => setAccount(null));
          }}
        >
          <LogOut className="mr-1 inline h-4 w-4" /> Sign out
        </button>
      </header>

      <section className="dispatch-panel">
        <h2 className="text-lg font-semibold text-[color:var(--dispatch-navy)]">Isolation status</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--dispatch-muted)]">
          <li>Auth storage key is dedicated (`shaheen-dispatch-auth-v1`) — not Driver LockGate.</li>
          <li>ACL table: `dispatch_portal_accounts` (review-only SQL in this PR).</li>
          <li>Dispatchers are not granted Compliance, rate, drug, Admin, or Personal data.</li>
          <li>Full Dispatch ops (loads / handover) stay on PR #25 — Batch 2 does not start Batch 3.</li>
        </ul>
      </section>

      <UserAdmin actor={account} />
    </div>
  );
}
