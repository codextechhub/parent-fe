import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import "./app.css";
// Geist, the same typeface school-fe, student-fe and the console use; Mono carries figures.
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";

import App from "./App";
import { applySchoolApp } from "./lib/school-app";
import { store } from "./redux/store";
import { schoolNameUrl } from "./utils/school-brand";

/**
 * The school's public name, read before anybody signs in.
 *
 * `applySchoolApp` asks the backend's per-school manifest first; this
 * fallback is used when that manifest cannot be served. The student app
 * reads it through RTK Query; the parent app has no RTK Query endpoints yet
 * (Phase 2), so a plain fetch stands in. Both call the same backend route.
 */
async function readSchoolName(slug: string): Promise<string> {
  const url = schoolNameUrl(slug);
  if (!url) return "";
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("name unreadable");
  const body = (await response.json()) as { name?: string };
  return (body.name ?? "").trim();
}

void applySchoolApp(readSchoolName);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
