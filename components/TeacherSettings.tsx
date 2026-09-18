'use client';
/* حسابات المعلمين — §٦ و §١٦: «لا وجود للمعلم في النظام اليوم إلا اسمًا مكتوبًا
   في بطاقة الحلقة … فهذا ما يُبنى: ينشئه المشرف من بوابة الإدارة ويربطه بحلقته».

   Nothing is typed twice. «وأسماء المعلمين السبعة موجودة في النظام اليوم داخل
   بطاقات الحلقات، فتُشتقّ منها الحسابات ولا تُكتب من جديد» — so this screen has
   one button, and the account it makes is bound to the halaqa whose card named
   the teacher.

   The temporary password appears ONCE. It is not stored in the clear anywhere,
   so the screen says so plainly rather than letting a supervisor assume he can
   come back for it. */
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Check, KeyRound, Loader2, Pause, Play, Printer, UserPlus,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty } from '@/components/ui';
import { Num } from '@/components/Num';
import { formatDate } from '@/lib/dates';
import { cx } from '@/lib/cx';

type Teacher = {
  id: string; fullName: string; username: string;
  active: boolean; mustChangePassword: boolean;
  lockedUntil: string | null; lastLoginAt: string | null;
  halaqa: { id: string; name: string } | null;
};

type Pending = { id: string; name: string; teacher: string };

type Issued = {
  teacherId: string; fullName: string; halaqaName: string;
  username: string; password: string;
};

export function TeacherSettingsCard() {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  /* What must be written down before this screen is closed. */
  const [issued, setIssued] = useState<Issued[]>([]);
  const [unnamed, setUnnamed] = useState<string[]>([]);
  const [reset, setReset] = useState<{ fullName: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/teachers');
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر القراءة.'); return; }
      setTeachers(d.teachers ?? []);
      setPending(d.pending ?? []);
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag); setErr('');
    try {
      const r = await fetch('/api/admin/teachers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر التنفيذ.'); return null; }
      await load();
      return d;
    } catch {
      setErr('تعذّر الاتصال بالخادم.');
      return null;
    } finally { setBusy(''); }
  };

  return (
    <>
      <Sheet className="rise mb-4">
        <SheetHead title="حسابات المعلمين"
          meta="رقم دخول من أربعة أرقام يبدأ من ٢٠٠١، وكلمة مرور يغيّرها المعلم في أول دخول"
          action={pending.length > 0 ? (
            <Btn variant="primary" icon={UserPlus} disabled={busy === 'ISSUE'}
              onClick={async () => {
                const d = await act({ action: 'ISSUE' }, 'ISSUE');
                if (d) { setIssued(d.issued ?? []); setUnnamed(d.unnamed ?? []); }
              }}>
              {busy === 'ISSUE'
                ? <><Loader2 size={16} className="animate-spin" />جارٍ الإنشاء…</>
                : <>أنشئ {pending.length === 1 ? 'حسابًا' : `${pending.length} حسابات`}</>}
            </Btn>
          ) : undefined} />

        {err && (
          <p role="alert"
            className="mb-4 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
            {err}
          </p>
        )}

        {/* ── the passwords, once ──────────────────────────────────────────── */}
        {issued.length > 0 && (
          <div className="mb-4 rounded-xl border-2 border-ok-200 bg-ok-100/60 p-4">
            <p className="flex items-center gap-2 text-body font-medium text-ok-700">
              <Check size={17} strokeWidth={2.2} />
              أُنشئ <Num>{issued.length}</Num> حسابًا — اكتب هذه الأرقام الآن
            </p>
            <p className="mt-1 text-panel text-ink-600">
              كلمة المرور لا تُحفظ مكشوفة في أي مكان، فإن أُغلقت الصفحة قبل كتابتها
              فالحل إعادة تعيينها لا البحث عنها.
            </p>
            <table className="mt-3 w-full border-collapse text-panel">
              <thead>
                <tr className="border-b border-ok-200 text-cap text-ink-600">
                  <th className="px-2 py-1.5 text-start font-medium">المعلم</th>
                  <th className="px-2 py-1.5 text-start font-medium">الحلقة</th>
                  <th className="px-2 py-1.5 text-start font-medium">رقم الدخول</th>
                  <th className="px-2 py-1.5 text-start font-medium">كلمة المرور</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((i) => (
                  <tr key={i.teacherId} className="border-b border-ok-200/60 last:border-0">
                    <td className="px-2 py-1.5 text-ink-900">{i.fullName}</td>
                    <td className="px-2 py-1.5 text-ink-600">{i.halaqaName}</td>
                    <td className="px-2 py-1.5 font-medium tabular-nums text-ink-900" dir="ltr">
                      {i.username}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink-900" dir="ltr">{i.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex gap-2">
              <Btn size="sm" icon={Printer} onClick={() => window.print()}>اطبع هذه القائمة</Btn>
              <Btn size="sm" onClick={() => setIssued([])}>كتبتها — أخفِها</Btn>
            </div>
          </div>
        )}

        {unnamed.length > 0 && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-warn-200 bg-warn-100 px-3.5 py-2.5 text-panel text-warn-700">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            حلقات لا اسم معلم في بطاقتها، فلا حساب لها:{' '}
            <span className="font-medium">{unnamed.join(' · ')}</span>. اكتب اسم
            المعلم في بطاقة الحلقة ثم أعد الإنشاء.
          </p>
        )}

        {reset && (
          <div className="mb-4 rounded-xl border-2 border-warn-200 bg-warn-100/60 p-4">
            <p className="text-body font-medium text-warn-700">
              كلمة مرور جديدة لـ{reset.fullName}
            </p>
            <p className="mt-1.5 font-mono text-h3 text-ink-900" dir="ltr">{reset.password}</p>
            <p className="mt-1 text-panel text-ink-600">
              اقرأها له الآن — يغيّرها هو في أول دخول، ولا تظهر مرة أخرى.
            </p>
            <Btn size="sm" className="mt-2.5" onClick={() => setReset(null)}>قرأتها — أخفِها</Btn>
          </div>
        )}

        {/* ── الحسابات ─────────────────────────────────────────────────────── */}
        {teachers === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="skel h-12 rounded-lg" />)}
          </div>
        ) : teachers.length === 0 ? (
          <Empty icon={UserPlus} title="لا حسابات بعد"
            body={pending.length > 0
              ? `${pending.length} حلقة بانتظار حساب لمعلمها — اضغط «أنشئ» أعلاه، وتُشتقّ الحسابات من أسماء المعلمين في بطاقات الحلقات.`
              : 'لا حلقات في النظام بعد. ارفع ملف الحلقات أولًا.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-body">
              <thead>
                <tr className="border-b border-ink-200 bg-page/50 text-cap text-ink-500">
                  <th className="px-3 py-2.5 text-start font-medium">المعلم</th>
                  <th className="px-3 py-2.5 text-start font-medium">حلقته</th>
                  <th className="px-3 py-2.5 text-start font-medium">رقم الدخول</th>
                  <th className="px-3 py-2.5 text-start font-medium">الحال</th>
                  <th className="px-3 py-2.5 text-start font-medium">آخر دخول</th>
                  <th className="px-3 py-2.5 text-start font-medium" />
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => {
                  const locked = !!t.lockedUntil && new Date(t.lockedUntil) > new Date();
                  return (
                    <tr key={t.id} className="border-b border-ink-150 last:border-0">
                      <td className={cx('px-3 py-2.5 font-medium',
                        t.active ? 'text-ink-900' : 'text-ink-400')}>
                        {t.fullName}
                      </td>
                      <td className="px-3 py-2.5 text-panel text-ink-600">
                        {t.halaqa?.name ?? <span className="text-warn-700">بلا حلقة</span>}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-ink-900" dir="ltr">
                        {t.username}
                      </td>
                      <td className="px-3 py-2.5">
                        {!t.active ? <Chip tone="ink">موقوف</Chip>
                          : locked ? <Chip tone="risk">مُقفل مؤقتًا</Chip>
                          : t.mustChangePassword ? <Chip tone="warn">لم يغيّر كلمته</Chip>
                          : <Chip tone="ok">نشط</Chip>}
                      </td>
                      <td className="px-3 py-2.5 text-panel text-ink-600">
                        {t.lastLoginAt
                          ? <Num>{formatDate(t.lastLoginAt.slice(0, 10))}</Num>
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-end">
                        <span className="flex justify-end gap-1.5">
                          <Btn size="sm" icon={KeyRound} disabled={busy === `R${t.id}`}
                            onClick={async () => {
                              const d = await act(
                                { action: 'RESET', teacherId: t.id }, `R${t.id}`);
                              if (d) setReset({ fullName: d.fullName, password: d.password });
                            }}>
                            كلمة مرور جديدة
                          </Btn>
                          <Btn size="sm" icon={t.active ? Pause : Play}
                            disabled={busy === `T${t.id}`}
                            onClick={() => act({ action: 'TOGGLE', teacherId: t.id }, `T${t.id}`)}>
                            {t.active ? 'أوقفه' : 'أعِده'}
                          </Btn>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-panel leading-relaxed text-ink-500">
          إيقاف معلم لا يمسّ بيانات حلقته ولا سجّلها السابق — يمنعه من الدخول
          وحده. ولكل معلم حلقة واحدة لا أكثر، وهو قيدٌ في قاعدة البيانات نفسها لا
          قاعدة في الشاشة.
        </p>
      </Sheet>
    </>
  );
}
