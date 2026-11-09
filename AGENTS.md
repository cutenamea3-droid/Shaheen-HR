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
- Three separate systems in one site: Driver Compliance lives in `src/` root (routes `/`, `/drivers`, `/s/*`), Admin & Attendance lives in `src/admin/` (route `/admin`), HR Personal lives in `src/personal/` (route `/personal`). Why: user requires each kept verbatim and never merged.
- Never share data, stores, or database clients between them; Admin uses only `src/admin/integrations/supabase/client.ts` (its own backend); Driver uses `src/integrations/supabase/client.ts`; HR Personal uses only `src/personal/integrations/supabase/client.ts` + `VITE_PERSONAL_*` (or local mock when `VITE_PERSONAL_AUTH_SECURE` is unset). Why: data must stay separate — Personal never uses company `app_state` / `tracker_sections`.
- Admin's original colors are scoped under `.admin-theme` in styles.css; HR Personal under `.personal-theme`; don't change either company's logic or look. Why: user requires identical behavior and styling for company apps.
