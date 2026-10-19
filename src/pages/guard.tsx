import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";

import { LoadingMark } from "@/components/loading-mark";
import { PageShell } from "@/components/layout/page-shell";
import { useAppSelector } from "@/redux/hooks";
import { useMeQuery } from "@/redux/services/portal-api";

/**
 * The shell guard.
 *
 * The parent reaches a signed-in route only if `me/` answers 200. While it
 * is being asked, a LoadingMark holds the page; a 404 or 401 sends the
 * parent back to sign-in (the sign-in page reads the slice to tell "not a
 * parent" from "session expired").
 */
export function RequireParent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const slice = useAppSelector((s) => s.auth);
  const { isLoading, isFetching } = useMeQuery(undefined, {
    // The me query runs on every mount of a guarded route; RTK Query keeps
    // its answer in the cache so later renders are instant.
    refetchOnMountOrArgChange: false,
  });

  useEffect(() => {
    // Nothing here yet; later phases will scroll-to-top on route change.
  }, [location.pathname]);

  if (slice.me) return <>{children}</>;
  if (slice.notAParent) return <Navigate to="/sign-in" replace />;
  if (slice.checked && !slice.me) return <Navigate to="/sign-in" replace />;
  if (isLoading || isFetching) {
    return (
      <PageShell className="min-h-dvh flex items-center justify-center">
        <LoadingMark label="Loading your account" className="h-32" />
      </PageShell>
    );
  }
  // First mount, nothing has resolved yet.
  return (
    <PageShell className="min-h-dvh flex items-center justify-center">
      <LoadingMark label="Loading your account" className="h-32" />
    </PageShell>
  );
}
