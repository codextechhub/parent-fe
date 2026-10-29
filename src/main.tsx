import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import "./app.css";
// Geist, the same typeface school-fe, student-fe and the console use; Mono carries figures.
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";

import App from "./App";
import { adoptHandover, useAccountStorage as setAccountStorage } from "./auth/device-account";
import { captureInstallPrompt } from "./install/install-prompt";
import { checkRelatedApps } from "./install/installed";
import { timeoutSignal } from "./lib/request-timeout";
import { applySchoolApp, keepName, keptName, nameThePage } from "./lib/school-app";
import { nativeAccountStorage } from "./native/account-storage";
import { isNativeApp } from "./native/platform";
import { logDebugToken } from "./native/push-debug";
import { loadSchoolCode } from "./native/school-code";
import { lookUpSchool } from "./native/school-lookup";
import { store } from "./redux/store";
import { schoolNameUrl } from "./utils/school-brand";
import { currentSchoolSlug } from "./utils/school-host";

const native = isNativeApp();

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
  const response = await fetch(url, { credentials: "include", signal: timeoutSignal() });
  if (!response.ok) throw new Error("name unreadable");
  const body = (await response.json()) as { name?: string };
  return (body.name ?? "").trim();
}

/**
 * The store app names its pages after the school it is set to: the name kept
 * from the last start at once, then the one the school's public name route
 * gives now. It has no manifest to read and no installed app to look for.
 */
function nameFromSchool(slug: string): void {
  const kept = keptName(slug);
  if (kept) nameThePage(kept.name);
  void lookUpSchool(slug).then((found) => {
    if (!found.ok) return;
    nameThePage(found.name);
    keepName({ slug, name: found.name });
  });
}

// Chrome fires `beforeinstallprompt` before React has mounted, so the listener
// goes on now; `checkRelatedApps` is asked once the school's manifest has been
// put on the page. The store app is already installed and has neither.
if (!native) {
  captureInstallPrompt();
  void applySchoolApp(readSchoolName).then(() => checkRelatedApps());
}

/** The store app knows its school only from what was kept, so that is read before anything draws. */
async function start() {
  if (native) {
    await loadSchoolCode();
    setAccountStorage(nativeAccountStorage);
    const slug = currentSchoolSlug();
    if (slug) nameFromSchool(slug);
    void logDebugToken();
  } else {
    // A sign-in handed across from school-fe is taken over first, so the first
    // read of who is signed in already finds it.
    await adoptHandover().catch(() => false);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>,
  );
}

void start();
