import { rmSync } from "node:fs";
import path from "path";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions, type UserConfig } from "vite";
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

const webConfig: UserConfig = {
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
  /**
   * `vite preview` serves the built app. The service worker only registers
   * from a real build, so Phase 6's push plumbing is verified here, not on
   * the dev server. The proxy mirrors the one above so a built app with
   * VITE_BACKEND_URL=/v1 can still reach a local backend.
   */
  preview: {
    port: 4176,
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
};

/**
 * The build mode of the store app: `vite build --mode native` (`npm run
 * build:native`). The web build above is untouched by it.
 *
 * The bundle is served from the app's own origin (`capacitor://localhost` on
 * iOS, `https://localhost` on Android), so it owns the root: `base` is `/`,
 * the router's basename is `/` (`native/platform.ts`), and it is written to
 * `dist-native/`, never `dist/`. There is no service worker, manifest or push
 * worker, so the PWA plugin is left out and its virtual module is stood in for
 * by a stub the update bar can import.
 *
 * The API is a separate origin, so the base is an absolute address:
 * `VITE_NATIVE_API_ORIGIN` (staging unless set), plus `/v1`. The school's
 * website, where "forgot password" goes, is `VITE_APP_BASE_DOMAIN`, staging's
 * unless set.
 */
const NATIVE_MODE = "native";
const STAGING_API_ORIGIN = "https://api-staging.codexng.com";
const STAGING_BASE_DOMAIN = "xvs-staging.codexng.com";

/** Points index.html at the root, drops the web manifest, and removes the web-only files from the output. */
function nativeShell(): Plugin {
  let outDir = "";
  return {
    name: "xvs-native-shell",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replace(/\s*<link rel="manifest"[^>]*>/, "").replaceAll("/parent/", "/"),
    },
    closeBundle() {
      for (const file of ["manifest.webmanifest", "push-sw.js"]) rmSync(path.join(outDir, file), { force: true });
    },
  };
}

function nativeConfig(env: Record<string, string>): UserConfig {
  const apiOrigin = (env.VITE_NATIVE_API_ORIGIN || STAGING_API_ORIGIN).replace(/\/+$/, "");
  return {
    base: "/",
    build: { outDir: "dist-native" },
    define: {
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(`${apiOrigin}/v1`),
      "import.meta.env.VITE_APP_BASE_DOMAIN": JSON.stringify(env.VITE_APP_BASE_DOMAIN || STAGING_BASE_DOMAIN),
    },
    plugins: [
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
      tailwindcss(),
      nativeShell(),
    ],
    resolve: {
      alias: {
        "virtual:pwa-register/react": path.resolve(__dirname, "./src/native/pwa-register-stub.ts"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
}

export default defineConfig(({ mode }) =>
  mode === NATIVE_MODE ? nativeConfig(loadEnv(mode, process.cwd(), "VITE_")) : webConfig,
);
