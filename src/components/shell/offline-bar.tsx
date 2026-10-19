import { WifiOff } from "lucide-react";

import { useAppSelector } from "@/redux/hooks";

/**
 * Says the school cannot be reached.
 *
 * Phase 2 only toggles on `navigator.onLine`; the parent app does not yet
 * keep offline copies of reads, so there is no "last updated" time to show.
 * Later phases that cache reads will put that back the way student-fe does.
 */
export function OfflineBar() {
  const offline = useAppSelector((s) => s.connectivity.offline);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 lg:px-6"
    >
      <WifiOff className="size-4 shrink-0" />
      <span className="min-w-0">
        You are offline. Some things cannot be shown until you reconnect.
      </span>
    </div>
  );
}
