/// <reference types="vite/client" />

declare module 'simple-duration' {
  /**
   * Parses a string using the Simple Duration Format and returns the number of seconds.
   * @param str A string in Simple Duration Format (e.g., '3h 10m 52s')
   * @returns The number of seconds corresponding to the duration
   */
  export function parse(str: string): number;

  /**
   * Formats a number of seconds into a Simple Duration Format string.
   * @param seconds The number of seconds to format
   * @param rounding The unit to round to (default: 'ms')
   * @returns A formatted string in Simple Duration Format
   */
  export function stringify(seconds: number, rounding?: 'y' | 'd' | 'h' | 'm' | 's' | 'ms' | 'µs' | 'ns'): string;

  /**
   * Units in Simple Duration Format:
   * y - A Julian year (365.25 days)
   * d - 24 hours
   * h - 60 minutes
   * m - 60 seconds
   * s - A second according to the SI
   * ms - 10e-3 seconds
   * µs - 10e-6 seconds
   * ns - 10e-9 seconds
   */
}
