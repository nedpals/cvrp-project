import { twMerge } from "tailwind-merge";
import clsx, { ClassValue } from "clsx";

export function cn(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

export const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};