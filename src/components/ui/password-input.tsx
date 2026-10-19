import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

import { Input } from "./input";

/**
 * A password box with a button that shows what was typed.
 *
 * A parent typing a new password twice on a phone keyboard mistypes often;
 * seeing it is quicker than retyping both boxes. The button is a real
 * `button` with a spoken label, and the box keeps its 16px text on a phone.
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-11 place-content-center text-muted-foreground"
      >
        {shown ? <Eye className="size-4.5" /> : <EyeOff className="size-4.5" />}
      </button>
    </div>
  );
}

export { PasswordInput };
