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
- Four isolated modules in one site: Driver Compliance (`src/` routes `/`, `/drivers`, `/s/*`, …), Admin & Attendance (`src/admin/` → `/admin`), HR Personal shell (`src/personal/` → `/personal`; full secure workspace on PR #16), Dispatch Operations (`src/dispatch/` → `/dispatch`; Batch 7 core ops). Why: user requires systems kept separate and never merged.
- Never share data, stores, or database clients across Driver ↔ Admin ↔ Personal. Dispatch may reuse the Driver *project* URL/key with dedicated auth storage (`shaheen-dispatch-auth-v1`) + `dispatch_portal_accounts` ACL — never Admin/Personal clients. Why: data and AuthZ must stay separate.
- Never bridge JWTs across Auth projects; localStorage roles / nav hide are not source of truth — enforce RLS/RPC/ACL. Why: Batch 2 security invariant.
- Admin colors stay under `.admin-theme`; Dispatch under `.dispatch-theme`; Personal under `.personal-theme`. Why: user requires identical per-system look.
- Dispatchers must be blocked by backend auth + RLS (`dispatch_portal_accounts`), not nav hide alone. Never expose compliance docs, banking, salaries, drug tests, rate cards, or Personal study data to Dispatch.
