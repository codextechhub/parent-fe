import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The title and one-line description at the top of every menu screen.
 *
 * Every screen inside the app draws its heading through this component, the
 * shared Finance, Procurement and Workflow screens included: `@xvs/finance`
 * imports `@/components/layout/page-header` from whichever application hosts
 * it, the same way it takes `PageShell`. That is what keeps the sizes from
 * drifting apart again; a page has no class string of its own to change.
 *
 * The size is the Support screen's: a 16px semi-bold title and a 12px grey
 * description under it. Hero headers on public, sign-in and guide pages are
 * not page headers and do not use this.
 *
 * The title is always the page's `<h1>`. The description is a block, so it
 * can carry a second line or a pill as well as text. Actions sit on the right
 * and drop underneath on a phone; nothing in the heading is truncated, so a
 * long title wraps instead of losing words.
 */
export function PageHeader({
  title,
  description,
  titleAside,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Shown on the title's line, after it: an `InfoHint`, a status pill. */
  titleAside?: React.ReactNode;
  /** Buttons and controls on the right of the heading. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
      {...props}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h1 className="min-w-0 break-words font-mont font-semibold text-black-01">
            {title}
          </h1>
          {titleAside}
        </div>
        {description ? (
          <div className="mt-0.5 text-xs text-gray-01">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
