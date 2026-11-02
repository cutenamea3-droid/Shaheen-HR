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
- Two separate systems in one site: Driver Compliance lives in `src/` root (routes `/`, `/drivers`, `/s/*`), Admin & Attendance lives in `src/admin/` (route `/admin`). Why: user requires both kept verbatim and never merged.
- Never share data, stores, or database clients between them; Admin uses only `src/admin/integrations/supabase/client.ts` (its own backend). Why: data must stay separate.
- Admin's original colors are scoped under `.admin-theme` in styles.css; don't change either system's logic or look. Why: user requires identical behavior and styling.
