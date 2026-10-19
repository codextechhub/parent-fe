import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // happy-dom provides document, storage and IndexedDB-free browser globals.
    environment: "happy-dom",
    // Node 25 and later put their own `localStorage` on the global object,
    // which happy-dom does not replace; turning Node's off leaves happy-dom's.
    execArgv: process.allowedNodeEnvironmentFlags.has("--no-experimental-webstorage")
      ? ["--no-experimental-webstorage"]
      : [],
    include: ["src/**/*.test.{ts,tsx}", "*.test.ts"],
    env: {
      VITE_BACKEND_URL: "http://test.local/v1",
    },
  },
});
