import { BrowserRouter, Link, Route, Routes } from "react-router";
import { Toaster } from "sonner";

import { PageShell } from "@/components/layout/page-shell";
import { SchoolMark } from "@/components/school-mark";
import { UpdateBar } from "@/components/update-bar";
import { useSchoolName } from "@/lib/use-school-name";
import { schoolLogoUrl } from "@/utils/school-brand";
import { currentSchoolSlug } from "@/utils/school-host";

/**
 * The parent app's routes, all under `/parent/`.
 *
 * Phase 1 scaffold: one route that proves the school's crest and name
 * reach the page, and a 404 fallback. Sign-in, the child switcher and the
 * portal screens arrive in Phase 2+; the router's basename matches Vite's
 * `base` so a route written here as `/fees` is served at `/parent/fees`
 * and never collides with school-fe or student-fe on the same origin.
 */
export default function App() {
  return (
    <BrowserRouter basename="/parent">
      <Routes>
        <Route index element={<PortalLanding />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <UpdateBar />
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}

/**
 * The scaffold's one screen: the school's crest and name, with "Parent Portal"
 * underneath. Phase 2 replaces this with sign-in and the first signed-in
 * screens.
 */
function PortalLanding() {
  const slug = currentSchoolSlug();
  const name = useSchoolName();

  if (!slug) {
    return (
      <PageShell className="min-h-dvh flex flex-col items-center justify-center gap-6 text-center">
        <SchoolMark logo={null} size={64} alt="XVS crest" animate={false} />
        <h1 className="font-mont text-base font-semibold text-black-01">
          No school at this address
        </h1>
      </PageShell>
    );
  }

  return (
    <PageShell className="min-h-dvh flex flex-col items-center justify-center gap-6 text-center">
      <SchoolMark logo={schoolLogoUrl(slug)} size={72} alt="School crest" />
      <div>
        <h1 className="font-mont text-xl font-semibold text-black-01">
          {name}
        </h1>
        <p className="mt-1 text-sm text-gray-01">Parent Portal</p>
      </div>
    </PageShell>
  );
}

/** Any address under /parent/ the app does not have. */
function NotFoundPage() {
  return (
    <PageShell className="min-h-dvh flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-mont text-xl font-semibold text-black-01">Page not found</h1>
      <Link to="/" className="text-sm text-primary underline underline-offset-4">
        Go back to the start
      </Link>
    </PageShell>
  );
}
