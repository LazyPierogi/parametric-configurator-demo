import type { Messages, SupportedLocale } from './types';

export type FlatMessages = Record<SupportedLocale, Record<string, string>>;

function flattenObject(input: Record<string, any>, prefix = ''): Record<string, string> {
  return Object.entries(input).reduce((acc, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(acc, flattenObject(value as Record<string, any>, nextKey));
    } else {
      acc[nextKey] = String(value ?? '');
    }
    return acc;
  }, {} as Record<string, string>);
}

export function flattenMessages(messages: Messages): FlatMessages {
  return Object.fromEntries(
    Object.entries(messages).map(([locale, tree]) => [locale, flattenObject(tree as Record<string, any>)]),
  ) as FlatMessages;
}
