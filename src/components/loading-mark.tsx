import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Under the app's base path, not the origin's root, which school-fe serves. */
const SRC = `${import.meta.env.BASE_URL}svg/xvs-loading.svg`;

export type LoadingMarkProps = {
  /** Size it with an `h-*` class; the width follows. Unsized it is 203px tall. */
  className?: string;
  /**
   * What a screen reader hears. Pass `null` where the mark sits beside text
   * that already says what is happening.
   */
  label?: string | null;
  /** The mark sits inside a busy button; see below. */
  inButton?: boolean;
};

/**
 * The XVS loading mark: the XVS crest, its lines writing themselves in
 * while two points circle its base. Used for every wait that has nothing
 * better to show, from the boot screen to a section loading, and handed to
 * the shared finance screens as the host's `LoadingMark`.
 *
 * It renders `public/svg/xvs-loading.svg` as an image, which keeps the
 * drawing's own styles and motion (including its reduced-motion rule) out of
 * the page's stylesheet. `index.html` shows the same file as the boot
 * screen, so it is cached before React first asks for it.
 *
 * Inside a button the crest is too small to read and its motion too small to
 * see, so a busy button (a Refresh button mid-fetch, the only caller that
 * asks) gets the spinning refresh arrow instead.
 */
export function LoadingMark({ className, label = "Loading", inButton = false }: LoadingMarkProps) {
  if (inButton) return <RefreshCw aria-hidden className={cn("animate-spin", className)} />;
  return (
    <img
      src={SRC}
      width={160}
      height={203}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={cn("h-[203px] w-auto shrink-0 select-none object-contain", className)}
      draggable={false}
    />
  );
}
