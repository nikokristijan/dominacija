import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: { default: 'Dominacija: Rise of Empires', template: '%s · Dominacija' },
  description: 'Asinkrona višeigračka strategija: 7 dana, jedno kraljevstvo, ostali su suparnici. Planiraj, pregovaraj, osvajaj.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Dominacija',
  appleWebApp: { capable: true, title: 'Dominacija', statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#5B3DF6' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
