import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";

import { LoadingMark } from "@/components/loading-mark";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/redux/hooks";
import { useMeQuery } from "@/redux/services/portal-api";

/**
 * The shell guard.
 *
 * The parent reaches a signed-in route only if `me/` answers 200. While it
 * is being asked, a LoadingMark holds the page; a 404 or 401 sends the
 * parent back to sign-in (the sign-in page reads the slice to tell "not a
 * parent" from "session expired").
 *
 * Any other failure (no connection, the school's server down, a timeout)
 * says nothing about the sign-in, so the parent stays signed in and is told
 * the account can't be loaded, with Try again. The read is also asked again
 * by itself when the connection comes back.
 */
export function RequireParent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const slice = useAppSelector((s) => s.auth);
  const { isFetching, isError, refetch } = useMeQuery(undefined, {
    // The me query runs on every mount of a guarded route; RTK Query keeps
    // its answer in the cache so later renders are instant.
    refetchOnMountOrArgChange: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    // Nothing here yet; later phases will scroll-to-top on route change.
  }, [location.pathname]);

  if (slice.me) return <>{children}</>;
  if (slice.notAParent) return <Navigate to="/sign-in" replace />;
  if (slice.checked && !slice.me) return <Navigate to="/sign-in" replace />;
  if (isError && !isFetching) {
    return (
      <PageShell className="min-h-dvh flex items-center justify-center">
        <div role="alert" className="flex max-w-xs flex-col items-center gap-4 px-5 text-center">
          <p className="text-[15px] leading-normal">
            Your account can&apos;t be loaded right now. Check your connection and try again.
          </p>
          <Button type="button" onClick={() => void refetch()}>Try again</Button>
        </div>
      </PageShell>
    );
  }
  return (
    <PageShell className="min-h-dvh flex items-center justify-center">
      <LoadingMark label="Loading your account" className="h-32" />
    </PageShell>
  );
}
