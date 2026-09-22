'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   مع-٣ صفحة التسجيل — «قلب البوابة كلها».

   «كل ما سبق مقدّمة لهذه الشاشة. وخطوات المعلم فيها ثلاث كما وصفتموها، ولا رابعة
   لها: التحضير · التسميع والتسجيل في وقت واحد · حفظ نتيجة الطالب.»

   The whole halaqa on ONE page, card under card, every card saving itself. No
   بدء and no إقفال — «ما يُحفظ يُحفظ، وما لم يُسجَّل لا يُطالَب به».

   Reworked 18 Sep 2026: the top of the screen is the same HERO the home screen
   has — the day, its two dates, what has been recorded so far, and the three
   modes inside it — rather than a bar. One object for «أين أنا ومتى», in the
   same place on both screens.

   وضع «يوم سابق» KEEPS ITS OWN DATE. Switching to «اليوم» shows today and
   nothing else: a teacher who looked at last Tuesday and then turned back to
   record this afternoon must not find Tuesday's card under his thumb.
   ───────────────────────────────────────────────────────────────────────── */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, CalendarDays, CheckCheck, CloudOff, Loader2, Save, Search, Users,
} from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Empty, Modal } from '@/components/ui';
import { DateField } from '@/components/DateField';
import { Num } from '@/components/Num';
import { useMe } from '@/components/teacher/Me';
import { DayHero } from '@/components/teacher/DayHero';
import {
  StudentCard, draftOf, type Card, type DailyTable, type Draft, type SaveState,
} from '@/components/teacher/StudentCard';
import { PeriodMode } from '@/components/teacher/PeriodMode';
import { COPY, type ModeCode } from '@/content/teacher';
import { foldArabic } from '@/lib/normalise';
import * as outbox from '@/lib/outbox';
import { cx } from '@/lib/cx';

export type DayPayload = {
  day: string;
  heading: { weekday: string; hijri: string; gregorian: string };
  opensItself: boolean;
  isToday: boolean;
  state: 'NOT_STARTED' | 'PARTIAL' | 'COMPLETE';
  counts: {
    roster: number; saved: number; present: number; absent: number;
    recited: number; points: number;
  };
  /** The halaqa's point table — what each card's «نقاط يومه» box counts by. */
  daily: DailyTable;
  cards: Card[];
};

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function RegisterScreen() {
  const { me, reload } = useMe();
  const router = useRouter();
  const sp = useSearchParams();
  /* «إذا ضغطت عليه ينقلني إلى لسان فترة الطالب ويحدّد لي الطالب مباشرة» — the
     student's file links here with the boy already named, so the teacher lands
     on the one screen where his days can be corrected, on the right boy. */
  const preselect = sp.get('student');
  const [mode, setMode] = useState<ModeCode>(
    () => (sp.get('mode') === 'PERIOD' || preselect ? 'PERIOD' : 'DAY'));
  /* Two dates, not one. `pastDay` is what وضع «يوم سابق» is looking at and it
     survives a trip to another mode; «اليوم» is always today. */
  const [pastDay, setPastDay] = useState(todayIso);
  const day = mode === 'PAST' ? pastDay : todayIso();

  const [data, setData] = useState<DayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [queued, setQueued] = useState(0);
  const [offline, setOffline] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const [q, setQ] = useState('');
  const [presentOnly, setPresentOnly] = useState(false);

  /* ── loading a day ─────────────────────────────────────────────────────── */
  const load = useCallback(async (which: string) => {
    setLoading(true); setLoadErr('');
    try {
      const res = await fetch(`/api/teacher/day?day=${which}`);
      const d = await res.json();
      if (!res.ok) { setLoadErr(d.error ?? 'تعذّر تحميل اليوم.'); setData(null); return; }
      setData(d);
      setDrafts(Object.fromEntries(d.cards.map((c: Card) => [c.studentId, draftOf(c)])));
      setStates(Object.fromEntries(d.cards.map((c: Card) => [c.studentId, 'CLEAN' as SaveState])));
      setErrors({});
    } catch {
      setLoadErr('تعذّر الاتصال. البطاقات المحفوظة على جهازك ستُرفع تلقائيًا.');
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (mode !== 'PERIOD') void load(day); }, [day, mode, load]);

  /* ── the outbox ────────────────────────────────────────────────────────── */
  useEffect(() => {
    setQueued(outbox.pendingCount());
    return outbox.subscribe(() => setQueued(outbox.pendingCount()));
  }, []);

  const post = useCallback((body: unknown) => fetch('/api/teacher/day', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), []);

  const drain = useCallback(async () => {
    if (!outbox.pendingCount()) return;
    const r = await outbox.flush(post);
    setOffline(r.offline);
    if (r.refused.length) {
      setErrors((e) => {
        const next = { ...e };
        for (const f of r.refused) next[f.key.split(':')[0]] = f.error;
        return next;
      });
      setStates((s) => {
        const next = { ...s };
        for (const f of r.refused) next[f.key.split(':')[0]] = 'ERROR';
        return next;
      });
    }
    if (r.sent > 0) { await load(day); reload(); }
  }, [post, load, day, reload]);

  useEffect(() => {
    void drain();
    const on = () => { setOffline(false); void drain(); };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [drain]);

  /* ── the body of one card's save ───────────────────────────────────────── */
  const bodyOf = useCallback((studentId: string, d: Draft) => ({
    day,
    studentId,
    status: d.status,
    thobe: d.thobe,
    note: d.note,
    lines: Object.entries(d.lines).map(([kind, v]) => ({ kind, ...v })),
    /* التلقين وحده — the server ignores them for anyone else. */
    talqeenSurah: d.talqeenSurah ?? null,
    talqeenAyah: d.talqeenAyah ? Number(d.talqeenAyah) : null,
  }), [day]);

  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* حفظٌ ثم مغادرة صار طريقًا معتادًا (حارس المغادرة أدناه)، فلا يُترك مؤقّت
     يوقظ جلبًا لشاشة غادرها صاحبها. */
  useEffect(() => () => { if (refresh.current) clearTimeout(refresh.current); }, []);
  const scheduleRefresh = useCallback(() => {
    if (refresh.current) clearTimeout(refresh.current);
    refresh.current = setTimeout(() => { void load(day); reload(); }, 400);
  }, [load, day, reload]);

  /* ── saving one card ───────────────────────────────────────────────────── */
  const saveCard = useCallback(async (card: Card) => {
    const d = drafts[card.studentId];
    /* A cleared card on a day that was never saved has nothing to write. A
       cleared card on a SAVED day is a deletion, and `bodyOf` sends the null
       status that asks for it. */
    if (!d || (!d.status && !card.savedAt)) return;
    const body = bodyOf(card.studentId, d);

    setStates((s) => ({ ...s, [card.studentId]: 'SAVING' }));
    setErrors((e) => ({ ...e, [card.studentId]: '' }));

    try {
      const res = await post(body);
      if (res.ok) {
        setStates((s) => ({ ...s, [card.studentId]: 'SAVED' }));
        scheduleRefresh();
        return;
      }
      const dd = await res.json().catch(() => ({}));
      setErrors((e) => ({ ...e, [card.studentId]: dd.error ?? 'تعذّر الحفظ.' }));
      setStates((s) => ({ ...s, [card.studentId]: 'ERROR' }));
    } catch {
      /* Unreachable — the card goes in the outbox and the bar says so (§٩-د).
         Stamped, so the server measures it against what it holds on the way
         back in; a live save is trusted, a replayed one is checked. */
      outbox.enqueue(`${card.studentId}:${day}`, { ...body, queued: true });
      setStates((s) => ({ ...s, [card.studentId]: 'QUEUED' }));
      setOffline(true);
    }
  }, [drafts, day, post, bodyOf, scheduleRefresh]);

  /* ── «حفظ الكل» ────────────────────────────────────────────────────────── */
  const dirtyIds = useMemo(
    () => Object.entries(states).filter(([, s]) => s === 'DIRTY' || s === 'ERROR')
      .map(([id]) => id)
      .filter((id) => drafts[id]),
    [states, drafts]);

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (!dirtyIds.length || savingAll) return true;
    setSavingAll(true);
    const cards = dirtyIds.map((id) => bodyOf(id, drafts[id]));
    setStates((s) => {
      const next = { ...s };
      for (const id of dirtyIds) next[id] = 'SAVING';
      return next;
    });

    try {
      /* One request, one transaction per card on the server — twenty-five round
         trips on mosque wifi is the difference between a second and a minute. */
      const res = await post({ day, cards });
      const d = await res.json().catch(() => ({}));
      const failed = new Map<string, string>(
        (d.failed ?? []).map((f: { studentId: string; error: string }) => [f.studentId, f.error]));
      setStates((s) => {
        const next = { ...s };
        for (const id of dirtyIds) next[id] = failed.has(id) ? 'ERROR' : 'SAVED';
        return next;
      });
      setErrors((e) => ({ ...e, ...Object.fromEntries(failed) }));
      scheduleRefresh();
      return failed.size === 0;
    } catch {
      for (const id of dirtyIds) outbox.enqueue(`${id}:${day}`, { ...bodyOf(id, drafts[id]), queued: true });
      setStates((s) => {
        const next = { ...s };
        for (const id of dirtyIds) next[id] = 'QUEUED';
        return next;
      });
      setOffline(true);
      /* في الصندوق لا في الهواء: البطاقة محفوظة على الجهاز وسترتفع وحدها،
         فالمغادرة بعدها لا تُضيّع شيئًا. */
      return true;
    } finally {
      setSavingAll(false);
    }
  }, [dirtyIds, drafts, day, post, bodyOf, scheduleRefresh, savingAll]);

  /* ── حارس المغادرة ─────────────────────────────────────────────────────
     «التسجيل يُحفظ بطاقةً بطاقة» يعني أن بطاقةً مملوءة غير محفوظة تبدو تمامًا
     كبطاقة محفوظة: اللون نفسه، والخانات نفسها. فيضغط المعلم لسانًا آخر أو
     رابطًا، وتُحمَّل الشاشة من جديد، ويذهب ما كتبه بلا أن يقول أحد شيئًا —
     وهذا يقع على من سجّل عشرين طالبًا، لا على من نسي واحدًا.

     فكل مخرج من الشاشة يمرّ من هنا: يُسمّى مَن لم يُحفظ، ويُعرض الحفظ. */
  const dirtyNames = useMemo(
    () => dirtyIds
      .map((id) => data?.cards.find((c) => c.studentId === id)?.fullName)
      .filter((n): n is string => !!n),
    [dirtyIds, data]);

  /** ما سيُفعل بعد الحفظ أو بعد التخلّي — في دالّة، لتبقى النيّة كما هي. */
  const [leaving, setLeaving] = useState<{ go: () => void } | null>(null);
  const [leaveErr, setLeaveErr] = useState('');

  const guard = useCallback((go: () => void) => {
    if (!dirtyIds.length) { go(); return; }
    setLeaveErr('');
    setLeaving({ go });
  }, [dirtyIds.length]);

  /* الروابط تُلتقط عند المستند لا عند كل رابط: شريط التنقّل وبطاقات الطلاب
     وكل ما في الصفحة روابط، ولفّها واحدًا واحدًا يترك واحدًا بلا حارس. */
  useEffect(() => {
    if (!dirtyIds.length) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // فتح في تبويب آخر
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      guard(() => router.push(url.pathname + url.search));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirtyIds.length, guard, router]);

  /* وإغلاق اللسان وتحديثه والخروج من البوابة تمسّها رسالة المتصفّح نفسه —
     لا نملك نافذتنا هناك، ومنعُ الضياع أهمّ من شكل التحذير. */
  useEffect(() => {
    if (!dirtyIds.length) return;
    const bye = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', bye);
    return () => window.removeEventListener('beforeunload', bye);
  }, [dirtyIds.length]);

  /* ── «الكل حاضر» ───────────────────────────────────────────────────────── */
  const allPresent = useCallback(() => {
    if (!data) return;
    const blank = data.cards.filter((c) => !drafts[c.studentId]?.status).map((c) => c.studentId);
    if (!blank.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      /* «ثم يعلّم المعلم الاستثناءات فقط» — this fills the blanks and never
         overrules a boy the teacher has already marked. */
      for (const id of blank) next[id] = { ...next[id], status: 'PRESENT' };
      return next;
    });
    setStates((prev) => {
      const next = { ...prev };
      for (const id of blank) next[id] = 'DIRTY';
      return next;
    });
  }, [data, drafts]);

  /* ── what is on screen ─────────────────────────────────────────────────── */
  const shown = useMemo(() => {
    const needle = foldArabic(q.trim());
    return (data?.cards ?? []).filter((c) => {
      if (needle && !foldArabic(c.fullName).includes(needle)) return false;
      if (presentOnly) {
        const st = drafts[c.studentId]?.status ?? c.status;
        if (st !== 'PRESENT' && st !== 'LATE') return false;
      }
      return true;
    });
  }, [data, q, presentOnly, drafts]);

  if (!me) return null;

  /* ── the period mode is its own screen ─────────────────────────────────── */
  if (mode === 'PERIOD') {
    return (
      <div>
        <DayHero me={me} day={day} data={null} mode={mode} onMode={setMode} />
        <SheetBelow>
          <PeriodMode onSaved={() => reload()} preselect={preselect} />
        </SheetBelow>
      </div>
    );
  }

  return (
    <div>
      <DayHero me={me} day={day} data={data} mode={mode}
        onMode={(m) => guard(() => setMode(m))} />

      <SheetBelow>
        {/* ── the bars that must be seen before a card is touched ──────────── */}
        {(offline || queued > 0) && (
          <Banner tone="warn" icon={CloudOff} rise={0}
            body={offline ? COPY.offline : COPY.queued}
            extra={queued > 0
              ? <><Num className="font-bold">{queued}</Num> بطاقة في الانتظار</> : null}
            action={queued > 0 ? { label: 'ارفعها الآن', onClick: () => void drain() } : undefined} />
        )}

        {data && !data.isToday && (
          <Banner tone="warn" icon={AlertTriangle} body={COPY.pastDayWarning} rise={0} />
        )}
        {data && data.isToday && !data.opensItself && (
          <Banner tone="info" icon={CalendarDays} body={COPY.exceptionalDay} rise={0} />
        )}

        {/* ── اليوم الذي يسجّله، ثم البحث فيه ────────────────────────────── */}
        {mode === 'PAST' && (
          <div className="rise">
            {/* تغيير اليوم يُعيد تحميل البطاقات، فهو مغادرةٌ أيضًا. */}
            <DateField value={pastDay} onChange={(v) => guard(() => setPastDay(v))}
              max={todayIso()} steppers hijriToo label="اليوم الذي تسجّله" />
          </div>
        )}

        {/* ── البحث، والكل حاضر، وحفظ الكل ──────────────────────────────── */}
        {data && data.cards.length > 0 && (
          <div className="rise space-y-2.5" style={{ animationDelay: '60ms' }}>
            <span className="relative block">
              <Search size={16}
                className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={COPY.searchInDay}
                className="h-11 w-full rounded-xl border border-ink-200 bg-paper pe-10 ps-3.5 text-base2 text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
            </span>

            <div className="flex gap-2">
              {/* «زرّ واحد على القائمة: الكل حاضر … وهذا هو الفرق بين دقيقة
                  وخمس دقائق». */}
              <Btn icon={CheckCheck} onClick={allPresent} className="flex-1">
                {COPY.allPresent}
              </Btn>
              <Btn variant="primary" icon={Save} onClick={saveAll}
                disabled={!dirtyIds.length || savingAll} className="flex-1">
                {savingAll ? <><Loader2 size={16} className="animate-spin" />{COPY.savingAll}</>
                  : dirtyIds.length
                    ? <>{COPY.saveAll} (<Num>{dirtyIds.length}</Num>)</>
                    : COPY.saveAll}
              </Btn>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div role="tablist" aria-label="تصفية البطاقات"
                className="flex gap-1 rounded-xl border border-ink-150 bg-paper p-1">
                {[
                  { on: false, label: COPY.everyone, n: data.cards.length },
                  { on: true, label: COPY.presentOnly, n: data.counts.present },
                ].map((f) => (
                  <button key={String(f.on)} role="tab" aria-selected={presentOnly === f.on}
                    onClick={() => setPresentOnly(f.on)}
                    className={cx('press min-h-[34px] rounded-lg px-3 text-panel font-medium transition-colors',
                      presentOnly === f.on ? 'bg-brand-800 text-white' : 'text-ink-600')}>
                    {f.label} <Num>{f.n}</Num>
                  </button>
                ))}
              </div>
              {q && (
                <button onClick={() => setQ('')} className="press text-panel text-ink-500">
                  امسح البحث
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── الحلقة ───────────────────────────────────────────────────────── */}
        {loading && !data ? (
          <ul className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => <li key={i} className="skel h-[190px] rounded-2xl" />)}
          </ul>
        ) : loadErr && !data ? (
          <Sheet>
            <Empty icon={AlertTriangle} title="تعذّر تحميل اليوم" body={loadErr}
              action={<Btn variant="primary" onClick={() => void load(day)}>أعد المحاولة</Btn>} />
          </Sheet>
        ) : !data || data.cards.length === 0 ? (
          <Sheet>
            <Empty icon={Users} title="لا طلاب" body={COPY.noRoster} />
          </Sheet>
        ) : shown.length === 0 ? (
          <Sheet>
            <Empty icon={Search} title="لا نتائج"
              body={presentOnly && !q
                ? 'لم تُعلِّم أحدًا حاضرًا بعد في هذا اليوم.'
                : COPY.noStudents}
              action={<Btn onClick={() => { setQ(''); setPresentOnly(false); }}>اعرض الجميع</Btn>} />
          </Sheet>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((c, i) => (
              <StudentCard key={c.studentId} card={c}
                draft={drafts[c.studentId] ?? draftOf(c)}
                state={states[c.studentId] ?? 'CLEAN'}
                error={errors[c.studentId] || undefined}
                daily={data.daily}
                rise={Math.min(i, 7) * 55 + 120}
                onChange={(next) => {
                  setDrafts((d) => ({ ...d, [c.studentId]: next }));
                  setStates((s) => ({ ...s, [c.studentId]: 'DIRTY' }));
                }}
                onSave={() => void saveCard(c)} />
            ))}
          </ul>
        )}
      </SheetBelow>

      <Modal open={!!leaving} onClose={() => setLeaving(null)} title={COPY.leaveTitle}
        footer={<>
          <Btn onClick={() => setLeaving(null)}>{COPY.leaveStay}</Btn>
          <Btn onClick={() => { const go = leaving?.go; setLeaving(null); go?.(); }}>
            {COPY.leaveDiscard}
          </Btn>
          <Btn variant="primary" icon={Save} disabled={savingAll}
            onClick={async () => {
              const ok = await saveAll();
              if (!ok) { setLeaveErr(COPY.leaveFailed); return; }
              const go = leaving?.go;
              setLeaving(null);
              go?.();
            }}>
            {savingAll ? <><Loader2 size={16} className="animate-spin" />{COPY.savingAll}</>
              : COPY.leaveSave}
          </Btn>
        </>}>
        <p className="text-base2 leading-relaxed text-ink-700">{COPY.leaveBody}</p>
        {/* بالأسماء لا بالعدد: «ثلاث بطاقات» تجعله يبحث عنها، والاسم يقول له
            أين كان. */}
        <ul className="mt-3 space-y-1 rounded-xl border border-warn-200 bg-warn-100/60 px-4 py-3">
          {dirtyNames.map((n) => (
            <li key={n} className="flex items-baseline gap-2 text-base2 text-warn-700">
              <span className="text-warn-700/70">•</span>{n}
            </li>
          ))}
        </ul>
        {leaveErr && <p className="mt-3 text-panel text-risk-700">{leaveErr}</p>}
      </Modal>
    </div>
  );
}

/** What sits under the hero. One page, so this is a stack and not a layer —
    «الهيرو والقسم اللي تحته … أبيهم صفحة وحدة» (client, 18 Sep 2026).

    Its contents arrive with the ordinary entrance every other screen has —
    «القسم الذي أسفل الهيرو أبي العناصر اللي فيه يكون لها دخولية سلسة كسائر
    الصفحات» (client, 18 Sep 2026). The hero itself still has none: it is the
    thing that is already there when the screen opens. The stagger is carried by
    each element rather than by a wrapper here, because half of them arrive
    after the day is fetched and an entrance played on an empty box is an
    entrance nobody sees. */
function SheetBelow({ children }: { children: React.ReactNode }) {
  return <div className="mt-3.5 space-y-3.5">{children}</div>;
}

export default function RegisterPage() {
  return <Suspense><RegisterScreen /></Suspense>;
}

function Banner({ tone, icon: I, body, extra, action, rise }: {
  tone: 'warn' | 'info';
  icon: typeof AlertTriangle;
  body: string;
  extra?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  /** Milliseconds into the screen's entrance — see `SheetBelow`. */
  rise?: number;
}) {
  return (
    <div style={rise != null ? { animationDelay: `${rise}ms` } : undefined}
      className={cx('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5',
        rise != null && 'rise',
        tone === 'warn' ? 'border-warn-200 bg-warn-100' : 'border-info-200 bg-info-100')}>
      <I size={16} strokeWidth={1.9}
        className={cx('mt-0.5 shrink-0', tone === 'warn' ? 'text-warn-700' : 'text-info-700')} />
      <p className={cx('min-w-0 flex-1 text-sm2 leading-relaxed',
        tone === 'warn' ? 'text-warn-700' : 'text-info-700')}>
        {body}{extra ? <> — {extra}</> : null}
      </p>
      {action && (
        <button type="button" onClick={action.onClick}
          className="press shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-panel font-medium text-ink-800">
          {action.label}
        </button>
      )}
    </div>
  );
}
