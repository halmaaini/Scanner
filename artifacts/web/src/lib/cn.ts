import { twMerge } from "tailwind-merge";

/**
 * Joins class names, skipping anything falsy: cn("a", cond && "b"). When two
 * utilities set the same property the later one wins (cn("gap-5", "gap-3") is
 * "gap-3"), so a component can take its caller's overrides without depending
 * on the order of the stylesheet.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts);
}
