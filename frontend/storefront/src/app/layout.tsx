import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/features/auth';
import { HomeProvider } from '@/features/home/home-provider';
import { LanguageProvider } from '@/lib/i18n/language-provider';
import { colors } from '@/design-system/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Trustlon', template: '%s | Trustlon' },
  description: 'Shop from Trustlon and verified sellers with escrow-protected payments.',
};

export const viewport: Viewport = { themeColor: colors.navy.DEFAULT };

/**
 * Fonts for every storefront language. The browser downloads a script's font only when a page
 * shows that script, so English visitors don't pay for the others.
 */
const FONT_FAMILIES = [
  'Inter',
  'Noto+Sans+Devanagari',
  'Noto+Sans+Bengali',
  'Noto+Sans+Tamil',
  'Noto+Sans+Telugu',
  'Noto+Sans+Kannada',
  'Noto+Sans+Malayalam',
];
const FONTS_URL = `https://fonts.googleapis.com/css2?${FONT_FAMILIES.map(
  (family) => `family=${family}:wght@100..900`,
).join('&')}&display=swap`;

/** Used by the sans font stack in design-system/tokens/typography.ts. */
const SCRIPT_FONT_VARIABLES = `:root{--font-bengali:'Noto Sans Bengali';--font-tamil:'Noto Sans Tamil';--font-telugu:'Noto Sans Telugu';--font-kannada:'Noto Sans Kannada';--font-malayalam:'Noto Sans Malayalam';}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Font availability must not block compilation of the root layout. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_URL} />
        <style>{SCRIPT_FONT_VARIABLES}</style>
      </head>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <HomeProvider>{children}</HomeProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
