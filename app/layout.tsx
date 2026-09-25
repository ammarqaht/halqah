import type { Metadata, Viewport } from 'next';
import './globals.css';

const TITLE = 'حلقة — حلقات جامع محمد العبدالكريم';
const DESC = 'نظام إدارة حلقات تحفيظ القرآن الكريم — الدمام، حي أُحد.';

/* الموقع لا يعرف عنوانه، وNext يفترض `localhost:3000` — فبطاقة المشاركة تشير
   إلى صورة على جهاز المرسِل، وواتساب يطلبها فلا يجدها فيعرض الرابط عاريًا.
   يُؤخذ من البيئة إن ضُبط، وإلا فمن اسم النطاق الذي نُشر عليه. */
const SITE = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
  || 'https://halqah-n0jqrp.cranl.net';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  /* شعار الحلقة في التبويب، وفي البطاقة التي تظهر حين يُرسَل الرابط.
     كان الموقع بلا أيقونة ولا بطاقة: التبويب يحمل حرف المتصفّح الافتراضي،
     ورابطٌ يُرسَل في واتساب يظهر عاريًا بلا صورة ولا اسم. */
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'حلقات جامع محمد العبدالكريم',
    title: TITLE,
    description: DESC,
    locale: 'ar_SA',
    images: [{ url: '/share.png', width: 1200, height: 630, alt: 'حلقات جامع محمد العبدالكريم' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: ['/share.png'],
  },
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
