import { cn } from "@/lib/utils";

/**
 * An iPhone-style on/off switch, green when on. It is a button with the
 * `switch` role, so a screen reader says "on" or "off"; `label` names what it
 * switches. Styles are in `profile.css`, beside the settings it sits in.
 */
export function ToggleSwitch({ on, onChange, disabled = false, label }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("toggle-switch", on && "is-on")}
    >
      <span aria-hidden="true" />
    </button>
  );
}
