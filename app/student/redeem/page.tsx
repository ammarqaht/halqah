'use client';
/* طا-٣ شحن كود — one big field, and the camera as a shortcut.
   Manual entry is the primary path and stays available at every moment: the
   camera fails for reasons a boy in a mosque cannot fix (no HTTPS, no camera,
   a refused permission), and each of those gets a plain sentence rather than a
   dead button. */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Camera, Check, X, Ticket, ImageUp } from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, INPUT } from '@/components/ui';
import { Num, pointWord } from '@/components/Num';
import { useMe } from '@/components/student/Me';
import { COPY } from '@/content/student';
import { codeFromScan, normaliseCode } from '@/lib/points';
import { cx } from '@/lib/cx';

type Done = { value: number; balance: number };

function RedeemScreen() {
  const { me, reload } = useMe();
  const sp = useSearchParams();
  /* Arrived from the card's own QR: `…/student/redeem?code=…`. The phone's
     camera brought him here, so the field is already filled and all that is
     left is one tap. Deliberately NOT auto-submitted — he should see what he
     is about to charge, and a page that spends a card on arrival is a page
     that spends it on a stray refresh. */
  const [code, setCode] = useState(() => codeFromScan(sp.get('code') ?? ''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Done | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
  };
  /* A camera left running is a hot phone and a flat battery. */
  useEffect(() => stop, []);

  const scan = async () => {
    setScanErr('');
    if (typeof window === 'undefined' || !window.isSecureContext) { setScanErr(COPY.scanInsecure); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setScanErr(COPY.scanNoCamera); return; }

    /* The cards carry a QR holding the bare code string — print/codes calls
       QRCode.toString(c.code). So decode a QR, not a barcode. The native
       detector costs zero bytes; the fallback is imported only on this tap, so
       it never enters the first-load bundle. */
    type Detector = { detect: (v: CanvasImageSource) => Promise<{ rawValue: string }[]> };
    const Native = (window as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } });
    } catch { setScanErr(COPY.scanRefused); return; }

    setScanning(true);
    await new Promise((r) => setTimeout(r, 0));
    const v = videoRef.current;
    if (!v) { stop(); return; }
    v.srcObject = stream.current;
    await v.play().catch(() => {});

    const detector = Native ? new Native({ formats: ['qr_code'] }) : null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let jsQR: typeof import('jsqr').default | null = null;
    if (!detector) jsQR = (await import('jsqr')).default;

    const tick = async () => {
      if (!stream.current || !v.videoWidth) { raf.current = requestAnimationFrame(tick); return; }
      let text: string | null = null;
      if (detector) {
        const hits = await detector.detect(v).catch(() => []);
        text = hits[0]?.rawValue ?? null;
      } else if (jsQR && ctx) {
        canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        text = jsQR(img.data, img.width, img.height)?.data ?? null;
      }
      /* A scan may hand back the card's URL or a bare code — both are read. */
      if (text) {
        const found = codeFromScan(text);
        if (found) { setCode(found); stop(); return; }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  /* The live camera fails for reasons a boy in a mosque cannot fix: an
     insecure context, a refused permission, a browser without getUserMedia, an
     iOS in-app webview that hands back a black frame. A PHOTO works in all of
     them — the same decoder, a still image instead of a stream — and «صوّر
     البطاقة» is an instruction he already understands. */
  const fromPhoto = async (file: File) => {
    setScanErr(''); setReading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      /* A phone photo is far larger than a QR needs. Scaling the long edge to
         1400px keeps every module distinct and cuts the decode from seconds to
         a blink on a cheap handset. */
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error();
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();

      type Detector = { detect: (v: CanvasImageSource) => Promise<{ rawValue: string }[]> };
      const Native = (window as unknown as { BarcodeDetector?: new (o: object) => Detector })
        .BarcodeDetector;

      let text: string | null = null;
      if (Native) {
        const hits = await new Native({ formats: ['qr_code'] }).detect(canvas).catch(() => []);
        text = hits[0]?.rawValue ?? null;
      }
      if (!text) {
        const jsQR = (await import('jsqr')).default;
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        text = jsQR(img.data, img.width, img.height)?.data ?? null;
      }

      const found = text ? codeFromScan(text) : '';
      if (found) setCode(found);
      else setScanErr(COPY.scanNoCodeInPhoto);
    } catch {
      setScanErr(COPY.scanPhotoFailed);
    }
    setReading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const c = normaliseCode(code);
    if (!c) return;
    setBusy(true); setErr(''); setDone(null);
    const res = await fetch('/api/student/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: c }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) { setErr(data?.error ?? 'تعذّر شحن الكود.'); setBusy(false); return; }
    setDone({ value: data.value, balance: data.balance });
    setCode(''); setBusy(false);
    reload();
  };

  if (me && !me.eligibleForPoints) {
    return (
      <Sheet className="rise">
        <SheetHead title="شحن كود" />
        <p className="text-base2 leading-relaxed text-ink-600">{COPY.talqeenPoints}</p>
      </Sheet>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Sheet className="rise">
        <SheetHead title={COPY.redeemTitle}
          meta={sp.get('code') ? COPY.fromCard : COPY.redeemHint} />

        <form onSubmit={submit} className="space-y-4">
          <input value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))}
            dir="ltr" autoCapitalize="characters" autoComplete="off" spellCheck={false}
            placeholder="XXXXX-XXXXX" aria-label="الكود"
            className={cx(INPUT, 'h-16 text-center font-mono text-xl2 tracking-[.22em]')} />

          <div className="grid grid-cols-2 gap-3">
            <Btn type="submit" variant="primary" size="xl" className="w-full"
              disabled={busy || normaliseCode(code).length < 4}>
              {busy ? <><Loader2 size={17} className="animate-spin" /> جارٍ الشحن…</> : 'اشحن'}
            </Btn>
            <Btn type="button" size="xl" icon={Camera} className="w-full"
              onClick={scanning ? stop : scan}>
              {scanning ? 'إيقاف المسح' : COPY.scan}
            </Btn>
          </div>
        </form>

        {scanning && (
          <div className="fade mt-4 overflow-hidden rounded-xl border border-ink-200 bg-ink-900">
            <video ref={videoRef} playsInline muted className="block max-h-[46vh] w-full object-cover" />
          </div>
        )}
        {/* Always offered, not only after the camera fails — on some phones it
            is the path that works, and finding that out should not require
            watching something else fail first. */}
        <div className="mt-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" aria-label={COPY.scanPhoto}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void fromPhoto(f);
              e.target.value = '';
            }} />
          <Btn type="button" size="lg" icon={reading ? undefined : ImageUp} className="w-full"
            disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading
              ? <><Loader2 size={16} className="animate-spin" /> جارٍ القراءة…</>
              : COPY.scanPhoto}
          </Btn>
          <p className="mt-1.5 text-center text-micro text-ink-500">{COPY.scanPhotoHint}</p>
        </div>

        {scanErr && (
          <p className="mt-3 rounded-lg border border-warn-200 bg-warn-100 px-3.5 py-2.5 text-panel text-warn-700">
            {scanErr}
          </p>
        )}

        {err && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-3 text-base2 text-risk-700">
            <X size={17} className="mt-0.5 shrink-0" />{err}
          </p>
        )}

        {done && (
          <div role="status" className="rise mt-3 rounded-xl border border-ok-200 bg-ok-100 p-4 text-center">
            <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-ok-700 text-white">
              <Check size={20} strokeWidth={2.6} />
            </span>
            <p className="text-base2 font-medium text-ok-700">
              أُضيفت <Num>{done.value}</Num> {pointWord(done.value)}
            </p>
            <p className="mt-1 text-panel text-ok-700/85">
              رصيدك الآن <Num className="font-medium">{done.balance}</Num> {pointWord(done.balance)}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function Redeem() {
  return <Suspense><RedeemScreen /></Suspense>;
}
