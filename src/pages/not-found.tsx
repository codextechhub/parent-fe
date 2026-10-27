import { Home, MapPin } from "lucide-react";
import { Link } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { SchoolMark } from "@/components/school-mark";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

import "./not-found.css";

/**
 * Any address the app does not have, before or after sign-in (design 5m).
 * The school's crest and "Page not found" at the top, a 404 card tilted over
 * a second one with a map pin beside them, the words, and "Go to Home" at the
 * foot. The styles stand alone, so student-fe and parent-fe keep the same
 * page.
 */
export function NotFoundPage() {
  const slug = currentSchoolSlug();

  return <PageShell className="not-found-page">
    <div className="not-found-wrap">
      <header className="not-found-header">
        <SchoolMark logo={slug ? schoolLogoUrl(slug) : null} size={30} animate={false} alt="School crest" />
        <strong>Page not found</strong>
      </header>
      <div className="not-found-body">
        <div className="not-found-art" aria-hidden="true">
          <span className="not-found-back-card" />
          <span className="not-found-card">
            <span className="not-found-card-dots"><i /><i /><i /></span>
            <span className="not-found-number">404</span>
            <span className="not-found-card-line" />
            <span className="not-found-card-line is-short" />
          </span>
          <span className="not-found-pin"><MapPin size={26} /></span>
        </div>
        <section className="not-found-copy" aria-labelledby="not-found-message">
          <span className="not-found-eyebrow">Wrong turn</span>
          <h1 id="not-found-message">We couldn&apos;t find this page.</h1>
          <p>The link may be old, or the address may have changed.</p>
        </section>
      </div>
      <div className="not-found-foot">
        <Link to="/" className="not-found-home"><Home size={19} aria-hidden="true" />Go to Home</Link>
      </div>
    </div>
  </PageShell>;
}
