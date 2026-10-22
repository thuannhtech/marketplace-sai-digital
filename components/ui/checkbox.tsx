import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/lib/icon";
import * as mdi from "@mdi/js";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export function Checkbox({
  checked = false,
  onCheckedChange,
  className,
  disabled,
  label,
  description,
  id,
  ...props
}: CheckboxProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        id={inputId}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        className={cn(
          "peer flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-white transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "bg-emerald-600 border-emerald-600 shadow-xs"
            : "border-neutral-300 bg-white hover:border-neutral-400",
        )}
        {...(props as any)}
      >
        {checked && <Icon path={mdi.mdiCheck} className="h-3.5 w-3.5 stroke-[2]" />}
      </button>
      {(label || description) && (
        <label
          htmlFor={inputId}
          className={cn(
            "text-xs cursor-pointer font-medium text-neutral-800",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {label && <div>{label}</div>}
          {description && <div className="text-[11px] text-subtle-text">{description}</div>}
        </label>
      )}
    </div>
  );
}
