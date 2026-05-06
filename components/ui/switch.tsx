import * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
  className,
  checked,
  disabled,
  onCheckedChange,
  ...props
}: {
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & Omit<React.ComponentProps<"button">, "onChange">) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onCheckedChange?.(!Boolean(checked));
      }}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-sidebar-border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Make checked state more visible (blue / primary).
        checked ? "bg-primary" : "bg-muted",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export { Switch };

