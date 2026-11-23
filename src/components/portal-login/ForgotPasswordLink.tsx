import { useState } from "react";
import { toast } from "sonner";

type ResetFn = (email: string) => Promise<{ error: { message: string } | null }>;

/**
 * Sends a password-reset email via the module's Auth client.
 * Friendly copy only — no admin/console jargon.
 */
export function ForgotPasswordLink({
  email,
  resetPasswordForEmail,
}: {
  email: string;
  resetPasswordForEmail: ResetFn;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="mt-2 text-sm font-semibold text-primary hover:underline disabled:opacity-60"
      disabled={busy}
      onClick={async () => {
        const mail = email.trim().toLowerCase();
        if (!mail || !mail.includes("@")) {
          toast.error("Enter your email first", {
            description: "Type the email for your account, then try Forgot password again.",
          });
          return;
        }
        setBusy(true);
        try {
          const { error } = await resetPasswordForEmail(mail);
          if (error) {
            toast.error("Could not send reset email", { description: error.message, duration: 10000 });
            return;
          }
          toast.success("Check your email", {
            description:
              "If an account exists for that address, we sent a link to choose a new password.",
            duration: 10000,
          });
        } catch (e) {
          toast.error("Could not send reset email", {
            description: e instanceof Error ? e.message : "Try again in a moment.",
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Sending…" : "Forgot password?"}
    </button>
  );
}
