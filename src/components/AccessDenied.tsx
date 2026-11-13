import { ShieldX } from "lucide-react";
import { MODULE_LABEL, type ModuleId } from "@/lib/module-access";

export function AccessDenied({
  module,
  homePath = "/",
  detail,
}: {
  module?: ModuleId | null;
  homePath?: string;
  detail?: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-44px)] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {module
            ? `You do not have permission for ${MODULE_LABEL[module]}.`
            : "You do not have permission to open this area."}
        </p>
        {detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          Hiding a nav tab is not security — access is enforced by backend ACL/RLS where applied, and by
          module gates in this app.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <a
            href={homePath}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to your home module
          </a>
        </div>
      </div>
    </div>
  );
}
