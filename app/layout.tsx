import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE } from '@/lib/site';

const TITLE = 'حلقات العبدالكريم — حلقات تحفيظ القرآن بجامع محمد العبدالكريم';
const DESC = 'حلقات العبدالكريم لتحفيظ القرآن الكريم في جامع محمد العبدالكريم — الدمام، حي أُحد. منصة الحلقات للمشرف والمعلم والطالب.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  applicationName: 'حلقات العبدالكريم',
  keywords: [
    'حلقات العبدالكريم', 'حلقة العبدالكريم', 'جامع محمد العبدالكريم', 'جامع العبدالكريم',
    'حلقات تحفيظ القرآن', 'تحفيظ القرآن الدمام', 'حلقات الدمام', 'حي أحد', 'حلقة',
  ],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  /* شعار الحلقة كاملًا — في التبويب، وفي البطاقة التي تظهر حين يُرسَل الرابط.
     كان الموقع بلا أيقونة ولا بطاقة: التبويب يحمل حرف المتصفّح الافتراضي،
     ورابطٌ يُرسَل في واتساب يظهر عاريًا بلا صورة ولا اسم.

     ولمّا جُرِّبت العلامة عند ستة عشر بكسلًا لم يبقَ من سطريها وكتابها إلا
     كتلة، فاقتُصر على «العَبْد» وحدها. والعميل اختار العلامة كاملة — وهي
     شعاره — فهي عليها، صُيِّرت من ألف بكسل حتى يكون التصغير أرفق ما يكون. */
  /* و`?v=2` يُلزم المتصفّح بطلبها من جديد: من فتح النطاق وهو يعرض صفحةَ
     خطأ حفظ أيقونتَها، ولا يعيد طلبها ما دام العنوانُ هو هو. */
  icons: {
    icon: [{ url: '/favicon.ico?v=2', sizes: 'any' }, { url: '/icon.png?v=2', type: 'image/png' }],
    apple: '/apple-icon.png?v=2',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: '/',
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
        {/* يقول لقوقل مَن صاحبُ الموقع وأين هو، فيُطابق بحثَ «حلقات العبدالكريم» */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'EducationalOrganization',
          name: 'حلقات العبدالكريم',
          alternateName: ['حلقات جامع محمد العبدالكريم', 'Mosque AlAbdulKarim Halaqat'],
          description: DESC,
          url: SITE,
          logo: `${SITE}/icon-512.png`,
          image: `${SITE}/share.png`,
          address: { '@type': 'PostalAddress', addressLocality: 'الدمام', addressRegion: 'المنطقة الشرقية', streetAddress: 'حي أُحد', addressCountry: 'SA' },
        }) }} />
      </body>
    </html>
  );
}
