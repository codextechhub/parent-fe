import { BrowserRouter, Link, Route, Routes } from "react-router";
import { Toaster } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { PageShell } from "@/components/layout/page-shell";
import { UpdateBar } from "@/components/update-bar";
import { RequireParent } from "@/pages/guard";
import PlaceholderPage from "@/pages/placeholder";
import SignInPage from "@/pages/sign-in";

/**
 * The parent app's routes, all under `/parent/`.
 *
 * `/sign-in` is public; everything else goes through `RequireParent`, which
 * reads `GET me/` and sends the parent back to sign-in on a 404 (not a
 * parent) or 401 (session expired). Phase 2 ships the shell, the child
 * switcher, auth, and placeholder screens for Home, Results, Fees, Notices
 * and Profile; later phases replace each placeholder.
 */
export default function App() {
  return (
    <BrowserRouter basename="/parent">
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          element={
            <RequireParent>
              <AppShell />
            </RequireParent>
          }
        >
          <Route index element={<PlaceholderPage title="Home" description="Your family at a glance." />} />
          <Route
            path="results"
            element={
              <PlaceholderPage
                title="Results"
                description="A child's released results."
                perChild
              />
            }
          />
          <Route path="fees" element={<PlaceholderPage title="Fees" description="Bills and payments for every child." />} />
          <Route path="notices" element={<PlaceholderPage title="Notices" description="Everything the school has posted for your family." />} />
          <Route path="profile" element={<PlaceholderPage title="My profile" description="Your details, and the children linked to you." />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <UpdateBar />
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}

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
