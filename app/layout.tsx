import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'حلقة — إدارة حلقات جامع محمد العبدالكريم',
  description: 'نظام إدارة حلقات تحفيظ القرآن الكريم: الطلاب والمستويات والنقاط والمتجر والاختبارات والتقارير.',
};
export const viewport: Viewport = { themeColor: '#0A403C' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        {/* React hoists these into <head>; the mark must be warm before the intro plays */}
        <link rel="preload" as="image" href="/assets/masjid.png" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/sans-Regular.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/serif-Medium.woff2" crossOrigin="anonymous" />
        {children}
      </body>
    </html>
  );
}
