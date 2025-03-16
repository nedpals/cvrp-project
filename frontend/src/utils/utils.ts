import { ClassNameValue, twMerge } from "tailwind-merge";
import clsx from "clsx";

export function cn(...args: ClassNameValue[]) {
  return clsx(twMerge(...args));
}