import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The app's text input.
 *
 * School-fe's `Input`, without its date and time branches, which this app does
 * not need yet. Text is 16px on a phone and 14px from `md` up: Safari on an
 * iPhone zooms the whole page into any box set smaller than 16px, and a parent
 * signing in would land on a page zoomed past its edges.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "placeholder:text-gray-02 bg-white border border-border focus-visible:border-primary/60 selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 rounded-md px-3 py-1 text-base md:text-sm transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-gray-01",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
