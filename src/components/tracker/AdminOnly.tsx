import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOptionalPortalAccount } from "./LockGate";

/** Compliance admin UI gate — backend RLS/RPC still authoritative for drug/rate/team. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const role = useOptionalPortalAccount()?.account.role;
  const navigate = useNavigate();
  useEffect(() => {
    if (role && role !== "admin") {
      void navigate({ to: "/access-denied", search: { module: "compliance" }, replace: true });
    }
  }, [role, navigate]);
  return role === "admin" ? children : null;
}
