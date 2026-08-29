'use client';
import { useState } from 'react';
import { cx } from '@/lib/cx';

/* The supplied lockup is 1600×524. The square icon block was measured (not
   guessed) at x 1229–1599, full height — see DESIGN.md §4. For the rail we crop
   to that block from the SAME file: never redrawn, never recoloured. */
const NAT = { w: 1600, h: 524 };
const CROP = { x: 1229, y: 0, w: 371, h: 524 };

export function LogoMark({ height = 32, white = true, className = '' }: {
  height?: number; white?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const scale = height / CROP.h;
  const boxW = CROP.w * scale;
  if (failed) {
    return <div className={cx('rounded-md border border-dashed', white ? 'border-white/35' : 'border-ink-300', className)}
      style={{ width: boxW, height }} role="img" aria-label="شعار حلقات جامع محمد العبدالكريم" />;
  }
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ width: boxW, height }}>
      <img src={white ? '/assets/masjid-cream.png' : '/assets/masjid.png'}
        alt="شعار حلقات جامع محمد العبدالكريم" onError={() => setFailed(true)}
        style={{ position: 'absolute', maxWidth: 'none',
                 width: NAT.w * scale, height: NAT.h * scale,
                 left: -CROP.x * scale, top: -CROP.y * scale }} />
    </div>
  );
}

export function LogoFull({ height = 56, white = false, className = '' }: {
  height?: number; white?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={cx('rounded-md border border-dashed', white ? 'border-white/35' : 'border-ink-300', className)}
      style={{ width: height * (NAT.w / NAT.h), height }} role="img" aria-label="شعار حلقات جامع محمد العبدالكريم" />;
  }
  return <img src={white ? '/assets/masjid-cream.png' : '/assets/masjid.png'}
    alt="شعار حلقات جامع محمد العبدالكريم" onError={() => setFailed(true)}
    style={{ height, width: 'auto' }} className={className} />;
}

export function LogoJamiyah({ height = 40, white = false, className = '' }: {
  height?: number; white?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={white ? '/assets/jamiyah-cream.png' : '/assets/jamiyah.png'}
    alt="جمعية تحفيظ القرآن الكريم بالمنطقة الشرقية — فرع غرب الدمام"
    onError={() => setFailed(true)} style={{ height, width: 'auto' }} className={className} />;
}
