// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Cloudflare Pages (shaheen-hr.pages.dev) was failing at runtime with the Nitro
// cloudflare-module SSR worker. This app is a client dashboard (localStorage +
// optional Supabase), so ship a static SPA shell instead of SSR.
//
// CF Pages settings:
//   Build command:      bun run build   (or npm run build)
//   Build output dir:   dist
//   Root directory:     /
// Env vars (Build + Runtime; Vite needs them at build time):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
export default defineConfig({
  // Skip Nitro Cloudflare worker packaging — Pages serves static assets only.
  nitro: false,
  tanstackStart: {
    // Keep custom server entry for local/dev SSR tooling; SPA mode skips route SSR in prod.
    server: { entry: "server" },
    spa: {
      enabled: true,
      // CF Pages serves /index.html for unmatched routes when no top-level 404.html exists.
      prerender: {
        outputPath: "/index.html",
      },
    },
  },
  vite: {
    // Cloudflare Pages UI is locked to output dir `dist`, so put the SPA shell
    // and assets at dist/index.html (not dist/client). Keep the SSR build used
    // only for prerender outside that folder so Pages does not upload it.
    environments: {
      client: {
        build: {
          outDir: "dist",
        },
      },
      ssr: {
        build: {
          outDir: "dist-server",
        },
      },
    },
  },
});
