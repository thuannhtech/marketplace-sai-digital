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
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-emerald-600 border-emerald-600" : "bg-neutral-300 border-neutral-300",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

export { Switch };

