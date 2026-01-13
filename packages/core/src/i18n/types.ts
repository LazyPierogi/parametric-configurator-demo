export const supportedLocales = ['en', 'pl', 'uk'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export type Messages = Record<SupportedLocale, Record<string, any>>;
