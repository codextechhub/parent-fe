import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The <main> every page sits in.
 *
 * This was a hand-copied class string on 70 pages in fifteen variants, and the
 * variants are the problem rather than the repetition. Two of them declare a
 * grid without `min-w-0`, which is the shape that had console-fe's user list
 * scrolling the whole window sideways: an implicit grid column is sized to its
 * min-content, so the day one of those pages grows a table whose columns do not
 * wrap, the column grows to the table's natural width and the overflow escapes
 * to the document. It is 133px past the right edge at 1200 and 507px at 820
 * when it happens, and it looks like the page is broken rather than one class
 * being absent.
 *
 * **So a grid cannot be asked for without its guard.** There is no `grid`
 * className to pass; there is a `grid` prop, and it always emits
 * `grid grid-cols-1` (`minmax(0, 1fr)`, which removes the min-content floor)
 * together with `min-w-0`.
 *
 * **The default stays a block, deliberately.** Most of these are block-level
 * today and correct, and turning them into grids to be consistent would change
 * margin collapsing across the app to fix a bug none of them have. The
 * DashboardLayout children wrapper is already `grid grid-cols-1 min-w-0`, and
 * that is what keeps a block main safe; what it cannot protect against is a
 * second grid declared inside it.
 *
 * The shell owns the page padding, `min-w-0`, and the grid guard. Rhythm
 * (`gap-*`, `space-y-*`), alignment (`content-start`) and colour stay with the
 * page: they differ page to page and are not what goes wrong.
 */

export function PageShell({
  className,
  grid = false,
  children,
  ...props
}: React.ComponentProps<"main"> & {
  /**
   * Lay the page out as a single-column grid.
   *
   * Use it when the page wants `gap` between its sections or `content-start`
   * so short pages do not stretch. Always safe: the column is
   * `minmax(0, 1fr)`, never `auto`.
   */
  grid?: boolean;
}) {
  return (
    <main
      className={cn(
        "min-w-0 px-5 pt-3 pb-8",
        grid && "grid grid-cols-1",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}
