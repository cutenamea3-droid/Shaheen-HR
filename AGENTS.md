<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Combined site rules
- Isolated systems in one site: Driver Compliance lives in `src/` root (routes `/`, `/drivers`, `/s/*`), Admin & Attendance lives in `src/admin/` (route `/admin`), Dispatch Operations lives in `src/dispatch/` (route `/dispatch`). Why: user requires each kept verbatim and never merged.
- Never share data, stores, or database clients between them; Admin uses only `src/admin/integrations/supabase/client.ts` (its own backend); Dispatch uses only `src/dispatch/integrations/supabase/client.ts` with its own auth storage key and `dispatch_*` tables/RLS. Why: data must stay separate.
- Admin's original colors are scoped under `.admin-theme` in styles.css; Dispatch under `.dispatch-theme`; don't change other systems' logic or look. Why: user requires identical behavior and styling for existing modules.
- Dispatchers must be blocked by backend auth + RLS (`dispatch_portal_accounts`), not nav hide alone. Never expose compliance docs, banking, salaries, drug tests, rate cards, or Personal study data to Dispatch.
