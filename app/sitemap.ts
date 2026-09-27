import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE}/login`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}/teacher/login`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE}/student/login`, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
