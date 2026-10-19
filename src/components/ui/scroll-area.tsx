import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * A scrollbar that sits ON the content instead of taking a slice out of it.
 *
 * **The problem is not that native scrollbars are ugly. It is that they are
 * part of the layout.** A native scrollbar takes its width out of the box it
 * belongs to, so a table that is 900px wide with nothing to scroll becomes
 * 885px wide the moment one more row arrives, and every column shifts. That is
 * the jump you see when a list grows past its box. It also means the same
 * screen is laid out differently on a Mac with a trackpad (overlay scrollbars,
 * zero width) and on Windows with a mouse (15px gone), so a layout verified on
 * one is not verified on the other.
 *
 * CSS alone cannot fix that. `scrollbar-width: thin` makes it narrower and
 * `::-webkit-scrollbar` restyles it, but a native scrollbar with a width still
 * occupies that width. The only way to float one over the content is to hide
 * the native one and draw the thumb yourself, which is what this does through
 * Radix: the viewport is the full width of the box, and the scrollbar is
 * positioned over it.
 *
 * **It is quiet until you go near it.** Nothing renders while the pointer is
 * elsewhere; hovering the box fades a thin thumb in; hovering the thumb itself
 * thickens it enough to grab. There is no track line, because a groove down the
 * side of every panel is furniture that says nothing the thumb does not.
 *
 * The trade this makes, stated so nobody rediscovers it as a bug: while the
 * thumb is showing, it covers about 10px at the right edge of the content. That
 * is the price of the content never moving, and it is the right way round -
 * something briefly on top of a word beats every column shifting sideways.
 *
 * **Where to use it.** Boxes with a bounded height: drawer bodies, dialog
 * lists, table wrappers, menus, grids that scroll sideways. **Not the page.**
 * Replacing the window's scroll breaks anchor links, `scrollIntoView` (which
 * the forms rely on to move the cursor to a missing field), sticky headers and
 * browser scroll restoration. The page keeps its native scroll, styled thin in
 * index.css so the two look like the same scrollbar.
 */

function ScrollArea({
  className,
  children,
  viewportClassName,
  viewportRef,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /** For the box that actually scrolls, when a caller needs to size it. */
  viewportClassName?: string;
  /** The scrolling element itself, for callers that drive it. */
  viewportRef?: React.Ref<HTMLDivElement>;
  orientation?: "vertical" | "horizontal" | "both";
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      // `hover` rather than `always`: the point is that it is not there until
      // it is wanted. Radix still shows it while a scroll is in progress, so
      // a touchpad flick is not silent.
      type="hover"
      scrollHideDelay={400}
      // `min-h-0 min-w-0` in the BASE, not left to callers.
      //
      // This component takes the overflow off the element and puts it on the
      // viewport inside. That is the whole point, and it has one consequence
      // that is invisible until it bites: an `overflow-y-auto` element is a
      // scroll container, and a scroll container's `min-height: auto` resolves
      // to zero - so as a flex child it shrank to the space available and
      // scrolled. This Root is NOT a scroll container, so `min-height: auto`
      // resolves to its CONTENT, and `flex-1` cannot shrink it below that.
      //
      // The drawer that found it: the event form's body grew to 1339px inside a
      // 700px sheet. Nothing scrolled, and the Cancel and Add buttons were
      // pushed off the screen entirely.
      //
      // Every caller that swaps `overflow-*` for this component inherits the
      // same trap, so the fix belongs here rather than in each of them.
      //
      // `flex flex-col` for the mirror-image trap on the other side. The
      // viewport used to take its height from `h-full`, and a percentage height
      // needs a DEFINITE height on the parent to resolve against. A caller
      // sizing this with `max-h-*` gives it no such thing, so the viewport
      // resolved to auto, grew to its content, and spilled out of a Root that
      // does not clip - a 585px list inside a 344px box, nothing scrolling and
      // the last rows drawn over whatever sat below. As a flex column the
      // viewport is bounded by the Root's max-height instead of guessing at it,
      // and callers that hand it a definite height are unaffected.
      className={cn("relative flex min-h-0 min-w-0 flex-col", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        // `[&>div]:min-w-0` because Radix wraps the children in a display:table
        // div, whose min-content floor is what makes a nowrap table stretch its
        // container instead of scrolling inside it. Same rule as the
        // DashboardLayout wrapper: horizontal page overflow is a bug.
        className={cn(
          // `flex-1 min-h-0` rather than `h-full`: see the Root's note. The
          // min-height floor is what lets it shrink below its content, which is
          // the whole point of a scrolling box.
          "w-full min-h-0 flex-1 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          "[&>div]:!block [&>div]:min-w-0",
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {(orientation === "vertical" || orientation === "both") && (
        <ScrollBar orientation="vertical" />
      )}
      {(orientation === "horizontal" || orientation === "both") && (
        <ScrollBar orientation="horizontal" />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        // `group` so the thumb can react to the bar being hovered, and
        // `touch-none select-none` so dragging it never selects the text
        // underneath.
        "group peer z-30 flex touch-none select-none p-px transition-[width,height,opacity] duration-150",
        // No track. A groove down the side of every panel is furniture.
        "bg-transparent",
        orientation === "vertical" &&
          "h-full w-1.5 hover:w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-1.5 hover:h-2.5 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative flex-1 rounded-full bg-black-01/25 transition-colors",
          "group-hover:bg-black-01/45 active:bg-black-01/60",
          // The thumb can get shorter than a pointer can hit on a long list.
          // Radix sizes it proportionally, so this is the floor.
          orientation === "vertical" ? "min-h-8" : "min-w-8",
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
