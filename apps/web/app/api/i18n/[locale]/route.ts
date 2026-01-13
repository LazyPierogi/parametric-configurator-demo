import { NextResponse } from 'next/server';
import { messages, defaultLocale } from '@curtain-wizard/core/src/i18n';
import type { SupportedLocale } from '@curtain-wizard/core/src/i18n';
import { flattenMessages } from '@curtain-wizard/core/src/i18n/flatten';

type RouteContext = {
  params: Promise<{ locale: SupportedLocale }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { locale } = await context.params;
  const flattened = flattenMessages(messages);
  const payload = flattened[locale] ?? flattened[defaultLocale];
  return NextResponse.json(payload ?? {}, { status: 200 });
}
