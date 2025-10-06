import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind class names while removing duplicates and handling conditional values.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
