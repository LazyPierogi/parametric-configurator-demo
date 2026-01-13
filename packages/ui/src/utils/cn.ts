type ClassValue = string | number | false | null | undefined;

/**
 * Lightweight className joiner to keep the UI kit framework-agnostic.
 */
export const cn = (...classes: ClassValue[]): string => {
  return classes.filter(Boolean).join(' ');
};
