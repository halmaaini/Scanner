import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import {
  buttonSizes,
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks further clicks while something is happening. */
  busy?: boolean;
}

/** `className` is for layout only (width, margin); size and colour come from the props. */
export function Button({
  variant = "primary",
  size = "default",
  busy = false,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(buttonStyles[variant], buttonSizes[size], className)}
    >
      {busy && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
