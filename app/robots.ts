import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/* الواجهةُ وأبوابُ الدخول للفهرسة، وما خلفها من أسماء الطلاب ودرجاتهم لا */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/teacher/login', '/student/login'],
      disallow: ['/admin', '/print', '/api', '/teacher/', '/student/'],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
