import path from "path";
import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

import { workboxOptions } from "./pwa.config";

/**
 * The XVS parent app.
 *
 * It is served at the school's own address under `/parent/`
 * (`bright-star.xvs.codexng.com/parent/`), beside school-fe and student-fe on
 * the same origin, so every asset and route lives under that base and nothing
 * here may claim a root path school-fe owns.
 *
 * Port 5176, strict: console-fe holds 5173, school-fe 5174 and student-fe
 * 5175, and a server that silently moved to the next free port would break
 * every link built against it. Open it as
 * `http://<school-slug>.localhost:5176/parent/`; the school is read off the
 * subdomain, as in production.
 *
 * `/v1` and `/media` are proxied to the API so cookies are first-party in
 * development, for the reason school-fe's config gives at length: the app at
 * `<slug>.localhost:5176` and the API at `localhost:8000` are different sites
 * to a browser. `changeOrigin` stays false so Django sees an Origin and Host
 * that agree. Point the proxy elsewhere with DEV_API_TARGET.
 */
const devApiTarget = process.env.DEV_API_TARGET ?? "http://localhost:8000";

/**
 * `/parent/app/<slug>/...` is the school's own manifest and crest icons,
 * passed through to the API's `/v1/portal/parent/app/<slug>/...`, exactly as
 * the production host does (see README, Hosting). The app asks for it there
 * itself (`src/lib/school-app.ts`), so the dev server and `vite preview` need
 * only this one path rule.
 */
const schoolApp: ProxyOptions = {
  target: devApiTarget,
  changeOrigin: false,
  rewrite: (address) => address.replace(/^\/parent\/app\//, "/v1/portal/parent/app/"),
};

export default defineConfig({
  base: "/parent/",
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      "/parent/app/": schoolApp,
      "/v1": { target: devApiTarget, changeOrigin: false },
      "/media": { target: devApiTarget, changeOrigin: false },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    VitePWA({
      // A new version waits for the parent to accept it rather than swapping
      // the page underneath them mid-payment.
      registerType: "prompt",
      // The manifest is a file in public/, linked from index.html, so the
      // per-school manifest the backend serves can take its place at the same
      // address without a rebuild.
      manifest: false,
      workbox: workboxOptions,
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
