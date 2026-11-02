# Shaheen Hr Dashboard

i have two differnet projects zip file i download from my git hub are you able to combile them, sepersatly in one without doing any changing line by line ???
these are my projects they have everything well maintaed , every logic every data i want stay same and i was add supa base in tyhem as wel i want yoiu to connect that and amnahge that and make sure i do not want he merge anything you can ask me any questions i also attached my company logo may be he did not going to have in zip file thats why
Target setup: Combined ZIP (Monorepo) - Keep both side-by-side in one repo/ZIP without touching or merging any code.
Supabase setup: Keep separate databases - Keep Admin on Lovable Cloud and Driver on external Supabase project.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shaheen-hr-dashboard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/55d5deba-4129-4783-82c4-29189a80a6e8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Cloudflare Pages

Production URL: https://shaheen-hr.pages.dev

This app deploys as a **static SPA** (client-side routing + localStorage; optional Supabase sync). Do not point Pages at Nitro/SSR worker output.

| Setting | Value |
|--------|--------|
| Build command | `bun run build` (or `npm run build`) |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |
| Framework preset | None / Vite |

**Environment variables** (Production + Preview, available at **Build** time — Vite inlines `VITE_*`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

See `.env.example`. Dashboard data still persists to `localStorage` in the browser (`shaheen-driver-tracker-v1`, Admin `hr-attendance-v1`); cloud sync remains optional when signed in.
