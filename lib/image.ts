'use client';
/* Gift images, until CranL's S3 bucket exists.
   SPEC.md §2 puts gift images in object storage and keeps blobs out of the
   database — right, and not available yet. Meanwhile they live in the browser
   store as data URLs, which makes size a correctness problem rather than a
   nicety: `localStorage` caps around 5 MB per origin, a phone photo is 3–6 MB,
   and `store.commit` swallows the quota error, so two unresized uploads would
   silently stop persisting the whole database.

   So every image is downscaled and re-encoded before it is ever stored. A gift
   card renders at roughly 160 px; 512 px covers retina with room to spare. */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 512;
const QUALITY = 0.72;

export type ImageError = 'NOT_AN_IMAGE' | 'TOO_LARGE' | 'DECODE_FAILED';

export const IMAGE_ERROR_AR: Record<ImageError, string> = {
  NOT_AN_IMAGE: 'اختر ملف صورة',
  TOO_LARGE: 'الصورة أكبر من ٥ ميغابايت',
  DECODE_FAILED: 'تعذّرت قراءة هذه الصورة',
};

/**
 * A JPEG data URL, longest edge at most 512 px. Rejects rather than guesses:
 * a caller gets either a small image or a reason to show the supervisor.
 */
export async function toStoredImage(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: ImageError }> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'NOT_AN_IMAGE' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'TOO_LARGE' };

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: 'DECODE_FAILED' };
    /* A transparent PNG would otherwise flatten onto black. Gift photos sit on
       a paper card, so white is the honest ground. */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return { ok: true, dataUrl: canvas.toDataURL('image/jpeg', QUALITY) };
  } catch {
    return { ok: false, error: 'DECODE_FAILED' };
  } finally {
    URL.revokeObjectURL(url);
  }
}
