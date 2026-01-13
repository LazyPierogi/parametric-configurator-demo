import './globals.css';
import { DM_Sans, Outfit } from 'next/font/google';
import { defaultLocale } from '@curtain-wizard/core/src/i18n';
import { LayoutProviders } from './layout-providers';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-outfit',
});

// Force dynamic rendering - app uses API routes and server-side env vars
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Access env var directly (loadEnv() was causing build issues)
  const catalogProvider = (process.env.CATALOG_PROVIDER || 'mock') as 'mock' | 'storefront';
  
  return (
    <html lang={defaultLocale} suppressHydrationWarning className={`${dmSans.variable} ${outfit.variable}`}>
      <head>
        <link href="https://cdn.prod.website-files.com/68f730303dc7d7de3ef5dc73/6915fcd7f3beb7e0c9c268ab_zaslony_logo_ico_32x32.jpg" rel="shortcut icon" type="image/x-icon" />
        <link href="https://cdn.prod.website-files.com/68f730303dc7d7de3ef5dc73/6915fba8180be729165eab72_zaslony_logo_ico_256x256.jpg" rel="apple-touch-icon" />
      </head>
      <body>
        <LayoutProviders catalogProvider={catalogProvider}>
          {children}
        </LayoutProviders>
      </body>
    </html>
  );
}
