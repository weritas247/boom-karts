import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "quiet";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center px-5 font-display text-sm tracking-wide",
        "rounded-md transition-transform duration-150 ease-out",
        "enabled:active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-fg",
        variant === "ghost" && "border border-border bg-surface text-fg",
        variant === "quiet" && "bg-transparent text-muted",
        className,
      )}
      {...props}
    />
  );
}
