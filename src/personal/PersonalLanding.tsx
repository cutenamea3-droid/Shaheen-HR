import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/AccessDenied";
import { probePersonalOwnerSeat } from "@/personal/lib/auth-probe";
import { isPreviewIsolated } from "@/lib/preview-isolated";

/**
 * Batch 2 Personal shell — isolation + honesty only.
 * Full study workspace + secure cloud sync remain on PR #16 / #17 (do not merge here).
 */
export function PersonalLanding() {
  const [ready, setReady] = useState(false);
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    let alive = true;
    void probePersonalOwnerSeat().then((ok) => {
      if (!alive) return;
      setOwner(ok);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    return <div className="p-10 text-sm text-muted-foreground">Loading HR Personal…</div>;
  }

  if (!owner && !isPreviewIsolated()) {
    return (
      <AccessDenied
        module="personal"
        homePath="/"
        detail="HR Personal uses a separate Auth project. Company Driver/Admin sessions do not unlock this module. Enable Personal via PR #16 after Personal Supabase + SQL approval."
      />
    );
  }

  return (
    <div className="personal-theme mx-auto min-h-[calc(100vh-44px)] max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">HR Personal</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Owner landing</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This Batch 2 shell confirms Personal stays isolated from Driver Compliance and Admin Attendance. The full
        study workspace, Personal-only RLS, and cloud sync ship on PR #16 (VU recovery on #17) — not merged here.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>No Driver or Admin JWT bridging.</li>
        <li>Personal switcher link appears only while already on <code>/personal</code>.</li>
        <li>Production requires dedicated Personal Supabase + review-only SQL + flag approval.</li>
      </ul>
      {isPreviewIsolated() && (
        <p className="mt-4 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Isolated preview — Personal owner seat mocked for routing tests only.
        </p>
      )}
    </div>
  );
}
