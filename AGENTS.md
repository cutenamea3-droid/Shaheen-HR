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

## Site rules (Compliance + Attendance app)

- Two modules only: Driver Compliance (`src/` routes `/`, `/drivers`, `/s/*`, …) and Admin & Attendance (`src/admin/` → `/admin`). Personal Study and Dispatch Operations code is **not** in this repository. Why: long-term stability — one site, two fully separated systems.
- Never share data, stores, or database clients across Driver ↔ Admin.
- Keep production wiring: Driver `VITE_SUPABASE_*` (`okzcwctsgurumnnzuxgg`) and Admin Lovable Cloud client — do not re-point. Zero Prod SQL deletes/overwrites without explicit approval. Existing Personal/Dispatch **cloud** tables/projects stay intact (no cloud deletes from this app).
- Never bridge JWTs across Auth projects; localStorage roles / nav hide are not source of truth — enforce RLS/RPC/ACL.
- Admin colors stay under `.admin-theme`.
