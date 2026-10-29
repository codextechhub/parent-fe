import { Home, RotateCw, TriangleAlert } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { SchoolMark } from "@/components/school-mark";
import { routerBasename } from "@/native/platform";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

import "./not-found.css";
import "./crash.css";

/**
 * The whole app crashed while drawing (`CrashBoundary` in `main.tsx`). It
 * keeps the 404 page's look: the crest at the top, the tilted card, the words
 * and the buttons at the foot. It sits outside the router, so it leaves by
 * loading the app again: Try again reloads this address, Go to Home loads
 * the home screen, in case this address is the one that crashes.
 */
export function CrashPage() {
  const slug = currentSchoolSlug();
  const base = routerBasename();
  const home = base.endsWith("/") ? base : `${base}/`;

  return <PageShell className="not-found-page crash-page">
    <div className="not-found-wrap">
      <header className="not-found-header">
        <SchoolMark logo={slug ? schoolLogoUrl(slug) : null} size={30} animate={false} alt="School crest" />
        <strong>Something went wrong</strong>
      </header>
      <div className="not-found-body">
        <div className="not-found-art" aria-hidden="true">
          <span className="not-found-back-card" />
          <span className="not-found-card">
            <span className="not-found-card-dots"><i /><i /><i /></span>
            <span className="not-found-number">!</span>
            <span className="not-found-card-line" />
            <span className="not-found-card-line is-short" />
          </span>
          <span className="not-found-pin"><RotateCw size={24} /></span>
        </div>
        <section className="not-found-copy" role="alert" aria-labelledby="crash-message">
          <span className="not-found-eyebrow">Sorry</span>
          <h1 id="crash-message">The app stopped working.</h1>
          <p>Try again. If it keeps happening, tell your school.</p>
        </section>
      </div>
      <div className="not-found-foot crash-actions">
        <button type="button" className="not-found-home" onClick={() => window.location.reload()}><RotateCw size={19} aria-hidden="true" />Try again</button>
        <a href={home} className="crash-secondary"><Home size={19} aria-hidden="true" />Go to Home</a>
      </div>
    </div>
  </PageShell>;
}

/**
 * One screen crashed inside the shell (`CrashBoundary` in `AppShell`): the
 * header and tab bar stay, so there is still a way elsewhere, and Try again
 * draws the screen again. student-fe and parent-fe keep the same file.
 */
export function CrashPanel({ onRetry }: { onRetry: () => void }) {
  return <section className="crash-panel" role="alert" aria-labelledby="crash-panel-message">
    <span className="crash-panel-icon" aria-hidden="true"><TriangleAlert size={24} /></span>
    <h2 id="crash-panel-message">This screen stopped working.</h2>
    <p>Try again, or open another tab. If it keeps happening, tell your school.</p>
    <button type="button" onClick={onRetry}><RotateCw size={18} aria-hidden="true" />Try again</button>
  </section>;
}
