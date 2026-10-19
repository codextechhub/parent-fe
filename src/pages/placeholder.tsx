import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { useLogoutMutation } from "@/redux/services/portal-api";
import { useAppSelector } from "@/redux/hooks";
import { useActiveChild } from "@/components/session/child-switcher";

/**
 * One Phase 2 placeholder.
 *
 * Each shell nav item points at a `PlaceholderPage` so the frame can be
 * exercised in a browser against the real API. Phases 3+ swap each one for
 * the real screen.
 */
export default function PlaceholderPage({
  title,
  description,
  perChild = false,
}: {
  title: string;
  description: string;
  perChild?: boolean;
}) {
  const me = useAppSelector((s) => s.auth.me);
  const activeChild = useActiveChild();
  const [logout, { isLoading }] = useLogoutMutation();

  return (
    <PageShell grid className="gap-5 content-start" aria-label={title}>
      <PageHeader title={title} description={description} />
      {perChild && activeChild && (
        <p className="rounded-md bg-primary/5 px-3 py-2 text-xs text-gray-01">
          Showing {activeChild.first_name}
          {activeChild.class_name ? ` (${activeChild.class_name})` : ""}.
        </p>
      )}
      <div className="rounded-lg border border-dashed border-border bg-white px-4 py-6 text-sm text-gray-01">
        <p className="font-medium text-black-01">Coming in a later phase</p>
        <p className="mt-1 text-xs">
          The frame, the sign-in and the child switcher ship this phase; this
          screen itself lands with the plan&rsquo;s next phase.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-white px-4 py-4 text-xs text-gray-01">
        <p className="font-medium text-black-01">
          You are signed in as {me?.parent.full_name}.
        </p>
        <p className="mt-1">
          {me?.children.length ?? 0} child
          {me?.children.length === 1 ? "" : "ren"} on the roll at{" "}
          {me?.school.name}.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => logout()}
          loading={isLoading}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </PageShell>
  );
}
