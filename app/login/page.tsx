'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   تسجيل الدخول — بوابة الإشراف. DESIGN.md §5
   Structure from mockup A. Palette + type from mockup C. Opening animation §5.2.

   The frame — the curtain, the form on the right, the ayah on the left and the
   two doors to the other portals — is `LoginFrame`, shared with بوابة الطالب
   وبوابة المعلم: «كلها تكون بيانات التسجيل في الجهة اليمنى والقسم الذي فيه الآية
   في الجهة اليسرى، والستارة تظهر لهم الثلاثة» (client, 18 Sep 2026).
   ───────────────────────────────────────────────────────────────────────── */
import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { LoginDoors, LoginFrame, useCurtain } from '@/components/LoginFrame';
import { Btn, Field, INPUT } from '@/components/ui';
import { Num } from '@/components/Num';
import { cx } from '@/lib/cx';
import { useDB } from '@/lib/store';

function LoginScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);
  const db = useDB();
  const [err, setErr] = useState('');
  const search = useSearchParams();
  const next = search.get('next') || '/admin';
  /* Why he is back here. Without this, being bounced out mid-afternoon looks
     like the password stopped working. */
  const reason = search.get('reason');

  const curtain = useCurtain(() => idRef.current?.focus());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: id.trim(), password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? 'تعذّر الدخول. حاول مرة أخرى.'); setBusy(false); return; }
      router.replace(next);
      router.refresh();
    } catch {
      setErr('تعذّر الاتصال بالخادم.');
      setBusy(false);
    }
  };

  return (
    <LoginFrame curtain={curtain}
      foot={
        /* Real figures, read from what this installation actually holds —
           never hard-coded, and never a student's name on a public screen. */
        db.students.length > 0 ? (
          <div className="flex items-end gap-10">
            {[[db.halaqat.length, 'حلقات'], [db.students.length, 'طالبًا']].map(([n, l]) => (
              <div key={String(l)}>
                <div className="font-display text-t1 text-white"><Num>{n}</Num></div>
                <div className="mt-0.5 text-xs2 text-white/55">{l}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs2 text-white/55">منصة إدارة الحلقات — الطلاب والمستويات والنقاط والاختبارات</p>
        )
      }>
      <h1 className="font-display text-d1 text-ink-900">تسجيل الدخول</h1>
      <p className="mt-2 text-base2 text-ink-600">ادخل ببيانات الحساب الذي زوّدك به المشرف.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="اسم المستخدم" htmlFor="nid">
          <input id="nid" ref={idRef} autoComplete="username"
            value={id} onChange={(e) => setId(e.target.value)} placeholder="admin"
            className={INPUT} />
        </Field>
        <Field label="كلمة المرور" htmlFor="pw">
          <div className="relative">
            <input id="pw" type={showPw ? 'text' : 'password'} autoComplete="current-password"
              value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••"
              className={cx(INPUT, 'pe-11')} />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              aria-pressed={showPw}
              className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-md text-ink-400 transition-colors hover:text-ink-700">
              {showPw ? <EyeOff size={17} strokeWidth={1.9} /> : <Eye size={17} strokeWidth={1.9} />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs2 text-ink-600">
            <input type="checkbox" defaultChecked
              className="h-4 w-4 rounded-sm border-ink-300 accent-brand-800" />
            تذكّرني على هذا الجهاز
          </label>
          <button type="button" className="text-xs2 text-brand-800 hover:underline">
            نسيت كلمة المرور؟
          </button>
        </div>

        {!err && reason && (
          <p className="rounded-md border border-warn-200 bg-warn-100 px-3 py-2.5 text-panel text-warn-700">
            {reason === 'idle'
              ? 'أُقفلت الجلسة تلقائيًا بعد ثلاثين دقيقة دون نشاط. سجّل الدخول للمتابعة.'
              : 'انتهت صلاحية الجلسة. سجّل الدخول للمتابعة.'}
          </p>
        )}

        {err && (
          <p role="alert" className="rounded-md border border-risk-200 bg-risk-100 px-3 py-2.5 text-panel text-risk-700">
            {err}
          </p>
        )}

        <Btn type="submit" variant="primary" size="xl" className="w-full" disabled={busy}>
          {busy ? <><Loader2 size={17} className="animate-spin" />جارٍ الدخول…</> : 'دخول'}
        </Btn>
      </form>

      {/* THREE portals, one domain. A student typing his national id here gets
          «غير صحيحة» and no idea why, and so does a teacher typing his
          four-digit number — this is the supervisor's door, and the other two
          are next to it. */}
      <LoginDoors here="admin" />

      <p className="mt-8 text-micro leading-relaxed text-ink-500">
        للاستفسار عن الحساب: مكتب الإشراف — حلقات جامع محمد العبدالكريم.
      </p>
    </LoginFrame>
  );
}

export default function LoginPage() {
  return <Suspense><LoginScreen /></Suspense>;
}
