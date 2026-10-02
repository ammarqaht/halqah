'use client';
/* تعديل مستوى طالب — the one place a boy's level is changed.

   «هنا ابيك تضيف خاصية تعديل مستوى الطالب، وتشيلها من اي مكان ثاني» and «طريقة
   التعديل لمستواه وخطته تثبت وتتغير عند الطالب وبالنظام والمعلم وكل شي»
   (client, 2 Oct 2026).

   Three steps, top to bottom: who, which level, what that will do — and the
   third is spelled out before he presses anything, because the move is not
   just a number: it issues the new level's sheet and puts the boy at its first
   مقرّر on his teacher's card. The server does all of it in one transaction
   (api/admin/level); this screen only asks and explains. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, GraduationCap, Layers3, Loader2, Printer, Users,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Empty, Field } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { TrackPicker } from '@/components/TrackPicker';
import { Num, juzPhrase } from '@/components/Num';
import { usePanel } from '@/components/PanelState';
import { store, useDB, ensureCurriculum } from '@/lib/store';
import { ajzaForLevel } from '@/lib/exams';
import { levelsFor, TRACK_AR, type StudentPlan, type Track } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { cx } from '@/lib/cx';

function LevelScreen() {
  const { panelOpen, setPanelOpen } = usePanel();
  const db = useDB();
  useEffect(() => { void ensureCurriculum(); }, []);
  const sp = useSearchParams();
  const router = useRouter();

  const trackFilter = (sp.get('track') as Track | null) ?? null;
  const [studentId, setStudentId] = useState(sp.get('student') ?? '');
  const [level, setLevel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ name: string; from: number | null; to: number } | null>(null);

  const withTrack = useMemo(
    () => db.students.filter((s) => s.track && s.track !== 'TALQEEN'), [db.students]);
  const eligible = useMemo(
    () => (trackFilter ? withTrack.filter((s) => s.track === trackFilter) : withTrack),
    [withTrack, trackFilter]);

  const student = eligible.find((s) => s.id === studentId) ?? null;
  const track = (student?.track ?? null) as Exclude<Track, 'TALQEEN'> | null;
  const halaqa = student?.halaqaId ? db.halaqat.find((h) => h.id === student.halaqaId) ?? null : null;

  /* A new student clears the pick: «55» chosen for one boy is not a decision
     about the next. */
  useEffect(() => { setLevel(null); setErr(''); }, [studentId]);

  const options = useMemo(() => eligible.map((s) => ({
    value: s.id,
    label: s.fullName,
    hint: [s.track ? TRACK_AR[s.track] : 'بلا مسار',
           s.halaqaId ? shortName(db.halaqat.find((h) => h.id === s.halaqaId)?.teacher ?? '') : 'بلا حلقة',
           s.currentLevel != null ? `المستوى ${s.currentLevel}` : 'بلا مستوى'].join(' · '),
  })).sort((a, b) => a.label.localeCompare(b.label, 'ar')), [eligible, db.halaqat]);

  /* Every level of his track, in the order they are walked — 60 down to 1 —
     and which of them the uploaded curriculum can actually issue a sheet for. */
  const levels = track ? levelsFor(track) : [];
  const covered = useMemo(() => new Set(
    db.curriculum.filter((d) => d.track === track).map((d) => d.level)), [db.curriculum, track]);

  const current = student?.currentLevel ?? null;
  const changed = level != null && level !== current;
  const ajza = track && level != null ? ajzaForLevel(track, level) : null;

  const save = async () => {
    if (!student || level == null || busy) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/admin/level', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, level }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? 'تعذّر الحفظ. حاول مرة أخرى.'); return; }
      store.adoptLevel(student.id, data.plan as StudentPlan);
      setDone({ name: student.fullName, from: current, to: level });
    } catch {
      setErr('تعذّر الاتصال. تأكّد من الشبكة ثم أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="الخطط" crumbs={['تعديل مستوى طالب', ...(student ? [student.fullName] : [])]}
        panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} />

      <div className="mx-auto max-w-column px-6 py-8 pb-16">

        {/* ── ١ · الطالب ─────────────────────────────────────────────── */}
        <Sheet className="rise mb-4">
          <SheetHead title="الطالب" meta="اختر المسار، ثم ابحث باسمه" />
          <div className="mb-4">
            <TrackPicker value={trackFilter} students={withTrack} tracks={['SILVER', 'GOLDEN']}
              onChange={(t) => {
                const p = new URLSearchParams(sp.toString());
                if (t) p.set('track', t); else p.delete('track');
                p.delete('student'); setStudentId('');
                router.replace(`/admin/plans/level${p.toString() ? `?${p}` : ''}`, { scroll: false });
              }} />
          </div>
          <div data-tour="level-student">
            <Field label="اسم الطالب" hint="طلاب التلقين خارج القائمة — لا مستوى لهم">
              <Combobox value={studentId} onChange={(v) => { setStudentId(v); setDone(null); }}
                options={options} placeholder="اختر الطالب" searchPlaceholder="ابحث بالاسم…"
                emptyText="لا طالب بهذا الاسم" />
            </Field>
          </div>

          {student && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-page px-4 py-3 text-panel">
              <span className="text-ink-600">مستواه الآن{' '}
                <span className="font-display text-h2 text-ink-900">
                  {current != null ? <Num>{current}</Num> : '—'}</span></span>
              <span className="text-ink-600">المسار{' '}
                <span className="font-medium text-ink-900">{track ? TRACK_AR[track] : '—'}</span></span>
              <span className="text-ink-600">الحلقة{' '}
                <span className="font-medium text-ink-900">{halaqa ? shortName(halaqa.teacher) : 'بلا حلقة'}</span></span>
            </div>
          )}
        </Sheet>

        {done && (
          <Sheet className="rise mb-4 border-ok-200 bg-ok-100/40">
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ok-100 text-ok-700">
                <CheckCircle2 size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900">
                  انتقل {shortName(done.name)} إلى المستوى <Num>{done.to}</Num>
                  {done.from != null && <> من <Num>{done.from}</Num></>}
                </p>
                <p className="mt-0.5 text-panel text-ink-600">
                  ظهر الآن عند الطالب وعند معلّمه، وصدرت خطته الجديدة بتاريخ اليوم.
                </p>
              </div>
              <Link href={`/admin/plans?student=${studentId}`}>
                <Btn icon={Printer}>طباعة خطته</Btn>
              </Link>
            </div>
          </Sheet>
        )}

        {/* ── ٢ · المستوى الجديد ─────────────────────────────────────── */}
        {student && track ? (
          <Sheet className="rise mb-4">
            <SheetHead title="المستوى الجديد"
              meta={`المستويات تنزل من ${levels[0]} إلى ١ — الرمادي لا منهج له بعد`} />
            <div data-tour="level-grid" className="flex flex-wrap gap-1.5">
              {levels.map((n) => {
                const ok = covered.has(n);
                const isCurrent = n === current;
                const picked = n === level;
                return (
                  <button key={n} type="button" disabled={!ok}
                    onClick={() => { setLevel(n); setDone(null); setErr(''); }}
                    title={!ok ? 'لا منهج لهذا المستوى في «منهج الحفظ»' : isCurrent ? 'مستواه الحالي' : `المستوى ${n}`}
                    className={cx(
                      'press relative grid h-11 w-11 place-items-center rounded-lg border text-base2 transition-colors',
                      picked ? 'border-brand-800 bg-brand-800 font-medium text-white shadow-[0_6px_16px_-8px_rgba(10,64,60,.8)]'
                        : isCurrent ? 'border-brand-300 bg-brand-50 font-medium text-brand-800'
                        : ok ? 'border-ink-200 bg-paper text-ink-700 hover:border-brand-700 hover:text-brand-800'
                        : 'cursor-not-allowed border-ink-150 bg-page text-ink-300')}>
                    <Num>{n}</Num>
                    {isCurrent && !picked && (
                      <span className="absolute -top-1.5 start-1/2 -translate-x-1/2 rounded bg-brand-700 px-1 text-[9px] leading-[14px] text-white">
                        الآن
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!db.curriculum.length && (
              <p className="mt-3 text-panel text-warn-700">«منهج الحفظ» لم يُحمَّل بعد — لحظة…</p>
            )}
          </Sheet>
        ) : !student ? (
          <Sheet className="rise">
            <Empty icon={Layers3} title="اختر طالبًا"
              body="ابحث باسمه، ثم اختر مستواه الجديد. يتغيّر عند الطالب وعند معلّمه وفي النظام كلّه معًا." />
          </Sheet>
        ) : null}

        {/* ── ٣ · ماذا سيحدث ─────────────────────────────────────────── */}
        {student && changed && (
          <Sheet className="rise">
            <div data-tour="level-effect">
              <SheetHead title={`المستوى ${level} — ماذا سيحدث`}
                meta={ajza != null ? `يقابل ${juzPhrase(ajza)}` : undefined} />
              <ul className="space-y-3">
                {[
                  { icon: GraduationCap, who: 'عند الطالب',
                    what: `يظهر مستواه ${level} وخطته الجديدة في بوابته فورًا.` },
                  { icon: Users, who: 'عند معلّمه',
                    what: `يبدأ من المقرّر ١ في المستوى ${level} — بطاقته في التحضير تتبع ذلك.` },
                  { icon: Layers3, who: 'في النظام',
                    what: `تصدر خطة المستوى ${level} بتاريخ اليوم، ويُسجَّل التعديل باسمك.` },
                ].map(({ icon: I, who, what }) => (
                  <li key={who} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-800">
                      <I size={16} strokeWidth={1.9} />
                    </span>
                    <span className="text-base2 leading-relaxed text-ink-700">
                      <span className="font-medium text-ink-900">{who}: </span>{what}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {err && (
              <p role="alert" className="mt-4 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
                {err}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Btn variant="primary" size="lg" data-tour="level-save" onClick={save} disabled={busy}
                icon={busy ? undefined : ArrowLeft}>
                {busy ? <><Loader2 size={17} className="animate-spin" />جارٍ الاعتماد…</>
                  : <>اعتماد المستوى <Num>{level}</Num></>}
              </Btn>
              <button type="button" onClick={() => setLevel(null)}
                className="text-panel text-ink-500 hover:text-ink-800">إلغاء</button>
            </div>
          </Sheet>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><LevelScreen /></Suspense>;
}
