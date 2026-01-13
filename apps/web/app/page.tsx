'use client';

import { useLocale } from '@/app/providers/locale-context';

export default function Page() {
  const { t } = useLocale();
  return (
    <main className="p-5">
      <h1>{t('home.heading')}</h1>
      <p>{t('home.intro')}</p>
      <p>
        {t('home.tryEstimatePrefix')}
        {' '}
        <a href="/estimate" className="text-active-accent underline">{t('home.tryEstimate')}</a>
        {' '}{t('home.tryEstimateMiddle')}{' '}
        <a href="/debug/seg" className="text-active-accent underline">{t('home.segmentationDebug')}</a>{' '}
        {t('home.tryEstimateSuffix')}
      </p>
      <p>
        {t('home.tryConfiguratorPrefix')}{' '}
        <a href="/configure" className="text-active-accent underline">{t('home.configurator')}</a>
      </p>
    
    </main>    
  );
}
