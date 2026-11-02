import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOptionalPortalAccount } from "./LockGate";

export function AdminOnly({ children }: { children: ReactNode }) {
  const role = useOptionalPortalAccount()?.account.role;
  const navigate = useNavigate();
  useEffect(() => {
    if (role && role !== "admin") void navigate({ to: "/", replace: true });
  }, [role, navigate]);
  return role === "admin" ? children : null;
}
