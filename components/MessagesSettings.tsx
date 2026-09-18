'use client';
/* رسائل الإدارة — «إشعار من الإدارة يكتبه المشرف ويظهر للمعلمين» (§مع-٢), and
   since 18 Sep 2026 للطلاب كذلك: «ويمكن يرسل رسائل للطلاب والمعلمين».

   THREE DECISIONS, IN ORDER, AND EACH ONE NARROWS THE NEXT: to which audience,
   then to whom of it, then what to say. The audience comes first because it
   changes who the list below is — and a message written to the wrong list is
   worse than one not sent.

   FOUR WAYS TO NAME THE STUDENTS — «كل الطلاب، بالحلقة، بالمسار، طلاب بعينهم»
   (client, 18 Sep 2026). The first three are one decision each; ticking a
   halaqa's thirteen boys one by one is thirteen chances to miss one. And the
   fourth is a SEARCH rather than a wall of names: «تظهر الأسماء في قائمة منسدلة
   بعد كتابة حرفين، وتحديد الاسم والتنقل فيها» — a hundred and seventeen chips
   is not a list anyone reads, so nothing is shown until two letters narrow it,
   the arrows walk it, and what was chosen is shown as chips underneath.

   HOW LONG THE LIST IS DECIDES HOW IT IS SHOWN. «قائمة المعلمين تكون ظاهرة
   جميعها» و«تحديد الحلقات يمكن الاختيار من متعدد وأظهر الحلقات كلهم في أقراص
   مستطيلة» (client, 18 Sep 2026): eight teachers and nine halaqat are a SHORT
   list, and a short list behind a search field is a list nobody can see before
   guessing at it. So both are laid out whole, as rectangles that toggle — and
   the halaqat take more than one, because «رسالة لحلقتين» was two sends before
   and is one now.

   «إلى الجميع» is a scope a supervisor chooses, never what happens because he
   ticked nobody. The send button says how many it is about to reach, and says
   it before it is pressed.

   And what was sent stays on the screen: ONE card per send, with who it went to
   — «كل رسالة في بطاقة وحدة ومعها لمن أُرسلت هذه الرسالة، وليس كل شخص في بطاقة
   لوحده». «أرسلتها» and «قرأها» are different facts, and a supervisor asking
   «هل وصلت؟» is asking the second one. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, GraduationCap, Loader2, Megaphone, Search, Send, Trash2,
  Users, X,
} from 'lucide-react';
import { Sheet, SheetHead } from '@/components/Sheet';
import { Btn, Chip, Empty, INPUT_BARE } from '@/components/ui';
import { Num, pluralNoun, studentWord } from '@/components/Num';
import { relativeDay } from '@/lib/dates';
import { foldArabic } from '@/lib/normalise';
import { cx } from '@/lib/cx';

type Teacher = { id: string; fullName: string; halaqa: string | null };
type Student = {
  id: string; fullName: string; halaqaId: string | null;
  halaqa: string | null; track: string | null; trackAr: string | null;
};
type Halaqa = { id: string; name: string };
type Message = {
  id: string; body: string; audience: 'TEACHERS' | 'STUDENTS'; scopeLabel: string;
  names: string[]; allNames: string[]; more: number;
  sent: number; read: number; byName: string; at: string;
};

type Audience = 'TEACHERS' | 'STUDENTS';
type Scope = 'ALL' | 'HALAQA' | 'TRACK' | 'PICK';

const MAX = 500;
/** «بعد كتابة حرفين» — nothing is listed until the search has narrowed it. */
const MIN_QUERY = 2;
const HITS = 8;

const TRACKS = [
  { id: 'SILVER', label: 'الفضي' },
  { id: 'GOLDEN', label: 'الذهبي' },
  { id: 'TALQEEN', label: 'التلقين' },
];

const reachWord = (n: number, a: Audience) =>
  a === 'STUDENTS'
    ? studentWord(n)
    /* «١٢ معلمين» is wrong the same way «١٢ طلاب» is: past ten the noun goes
       back to the accusative singular. `pluralNoun` is where that rule lives. */
    : pluralNoun(n, 'معلم', 'معلمين', 'معلمين', 'معلمًا');

export function MessagesSettingsCard() {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [halaqat, setHalaqat] = useState<Halaqa[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [audience, setAudience] = useState<Audience>('TEACHERS');
  const [scope, setScope] = useState<Scope>('ALL');
  const [halaqaIds, setHalaqaIds] = useState<string[]>([]);
  const [track, setTrack] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [body, setBody] = useState('');

  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState<number | null>(null);
  const [openNames, setOpenNames] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/messages');
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر القراءة.'); return; }
      setTeachers(d.teachers ?? []);
      setStudents(d.students ?? []);
      setHalaqat(d.halaqat ?? []);
      setMessages(d.messages ?? []);
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /* Switching audience resets the aim: a tick meant for a teacher is not a tick
     for the student who happens to sit at the same index. */
  const switchTo = (a: Audience) => {
    setAudience(a); setScope('ALL'); setPicked([]);
    setHalaqaIds([]); setTrack(''); setSent(null);
  };

  const people: { id: string; fullName: string; meta: string | null }[] =
    audience === 'TEACHERS'
      ? (teachers ?? []).map((t) => ({ id: t.id, fullName: t.fullName, meta: t.halaqa }))
      : students.map((x) => ({
          id: x.id, fullName: x.fullName,
          meta: [x.halaqa, x.trackAr].filter(Boolean).join(' · ') || null,
        }));

  /** How many the send will reach, computed the same way the server will. */
  const reach = useMemo(() => {
    if (scope === 'ALL') return people.length;
    if (scope === 'HALAQA') {
      return halaqaIds.length
        ? students.filter((x) => x.halaqaId && halaqaIds.includes(x.halaqaId)).length
        : 0;
    }
    if (scope === 'TRACK') return track ? students.filter((x) => x.track === track).length : 0;
    return picked.length;
  }, [scope, people.length, halaqaIds, track, picked.length, students]);

  const send = async () => {
    if (!body.trim() || reach === 0) return;
    setBusy('send'); setErr(''); setSent(null);
    try {
      const r = await fetch('/api/admin/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, audience, scope, halaqaIds, track, ids: picked }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'تعذّر الإرسال.'); return; }
      setSent(d.all ? people.length : d.sent);
      setBody(''); setPicked([]); setScope('ALL'); setHalaqaIds([]); setTrack('');
      await load();
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
    finally { setBusy(''); }
  };

  const withdraw = async (id: string) => {
    setBusy(id); setErr('');
    try {
      const r = await fetch(`/api/admin/messages?id=${id}`, { method: 'DELETE' });
      if (!r.ok) { setErr('تعذّر السحب.'); return; }
      await load();
    } catch { setErr('تعذّر الاتصال بالخادم.'); }
    finally { setBusy(''); }
  };

  const scopes: { id: Scope; label: string }[] = audience === 'STUDENTS'
    ? [{ id: 'ALL', label: 'كل الطلاب' }, { id: 'HALAQA', label: 'بالحلقة' },
       { id: 'TRACK', label: 'بالمسار' }, { id: 'PICK', label: 'طلاب بعينهم' }]
    : [{ id: 'ALL', label: 'كل المعلمين' }, { id: 'PICK', label: 'معلمون بأعيانهم' }];

  return (
    <>
      <Sheet className="rise mb-4">
        <SheetHead title="رسالة جديدة"
          meta="تصل في «تنبيهاتي» بعلامة غير مقروء — ولا تصل أولياء الأمور" />

        {err && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-risk-200 bg-risk-100 px-3.5 py-2.5 text-panel text-risk-700">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />{err}
          </p>
        )}

        {/* ── ١. إلى أيّ الفريقين ─────────────────────────────────────────── */}
        <p className="mb-2 text-panel font-medium text-ink-800">إلى</p>
        <div className="flex gap-1 rounded-xl border border-ink-150 bg-page p-1">
          {([
            { id: 'TEACHERS' as const, label: 'المعلمون', icon: Users, n: teachers?.length ?? 0 },
            { id: 'STUDENTS' as const, label: 'الطلاب', icon: GraduationCap, n: students.length },
          ]).map((a) => (
            <button key={a.id} type="button" onClick={() => switchTo(a.id)}
              aria-pressed={audience === a.id}
              className={cx('press flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-body font-medium transition-colors',
                audience === a.id ? 'bg-brand-800 text-white' : 'text-ink-600 hover:text-ink-900')}>
              <a.icon size={15} strokeWidth={1.9} />{a.label}
              <Num className={cx('text-cap', audience === a.id ? 'text-brand-200' : 'text-ink-400')}>
                {a.n}
              </Num>
            </button>
          ))}
        </div>

        {/* ── ٢. أيّهم ────────────────────────────────────────────────────── */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {scopes.map((o) => (
            <button key={o.id} type="button"
              onClick={() => { setScope(o.id); setSent(null); }}
              aria-pressed={scope === o.id}
              className={cx('press rounded-lg border-2 px-3.5 py-2 text-panel font-medium transition-colors',
                scope === o.id ? 'border-brand-700 bg-brand-100 text-brand-800'
                  : 'border-ink-200 bg-paper text-ink-600')}>
              {o.label}
            </button>
          ))}
        </div>

        {/* الحلقات كلها ظاهرة، ويُختار منها ما شاء — «يمكن الاختيار من متعدد
            وأظهر الحلقات كلهم في أقراص مستطيلة». Nine of them fit on a line and
            a half, and a dropdown would hide a list shorter than itself. */}
        {scope === 'HALAQA' && (
          <Picker
            items={halaqat.map((h) => ({
              id: h.id, label: h.name,
              n: students.filter((x) => x.halaqaId === h.id).length,
            }))}
            picked={halaqaIds} onChange={(v) => { setHalaqaIds(v); setSent(null); }}
            empty="لا حلقات بعد." hint="اختر حلقة أو أكثر" />
        )}

        {scope === 'TRACK' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {TRACKS.map((t) => (
              <button key={t.id} type="button"
                onClick={() => { setTrack(t.id); setSent(null); }}
                aria-pressed={track === t.id}
                className={cx('press rounded-lg border px-3.5 py-2 text-panel transition-colors',
                  track === t.id ? 'border-brand-700 bg-brand-50 font-medium text-brand-800'
                    : 'border-ink-200 bg-paper text-ink-600 hover:border-ink-300')}>
                المسار {t.label}
                <Num className="ms-1.5 text-micro text-ink-400">
                  {students.filter((x) => x.track === t.id).length}
                </Num>
              </button>
            ))}
          </div>
        )}

        {/* المعلمون قلّة، فيُعرضون كلهم — «قائمة المعلمين تكون ظاهرة جميعها».
            والطلاب مئة وسبعة عشر، فيُبحث عنهم. */}
        {scope === 'PICK' && (audience === 'TEACHERS' ? (
          <Picker
            items={(teachers ?? []).map((t) => ({ id: t.id, label: t.fullName, meta: t.halaqa }))}
            picked={picked} onChange={(p) => { setPicked(p); setSent(null); }}
            empty="لا معلمين بعد." hint="اختر معلمًا أو أكثر" />
        ) : (
          <NamePicker people={people} picked={picked} onChange={(p) => { setPicked(p); setSent(null); }} />
        ))}

        {/* ── ٣. ما يُقال ─────────────────────────────────────────────────── */}
        <label className="mt-4 block">
          <span className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-panel font-medium text-ink-800">نصّ الرسالة</span>
            <span className="text-micro text-ink-500">
              <Num>{body.length}</Num> / <Num>{MAX}</Num>
            </span>
          </span>
          <textarea value={body} maxLength={MAX} rows={3}
            onChange={(e) => { setBody(e.target.value); setSent(null); }}
            placeholder={audience === 'TEACHERS'
              ? 'اجتماع المعلمين يوم الأحد بعد العصر في مكتب المشرف…'
              : 'تُقام مسابقة الحفظ يوم الخميس بعد صلاة العصر…'}
            className={cx(INPUT_BARE, 'w-full px-3.5 py-2.5 leading-relaxed')} />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Btn variant="primary" icon={busy === 'send' ? undefined : Send}
            disabled={!body.trim() || reach === 0 || busy === 'send'}
            onClick={send}>
            {busy === 'send'
              ? <><Loader2 size={16} className="animate-spin" />يُرسل…</>
              : <>أرسل إلى <Num>{reach}</Num> {reachWord(reach, audience)}</>}
          </Btn>
          {sent != null && (
            <span className="flex items-center gap-1.5 text-panel text-ok-700">
              <Check size={15} strokeWidth={2.4} />
              وصلت <Num>{sent}</Num> — تظهر لهم في تنبيهاتهم
            </span>
          )}
        </div>
      </Sheet>

      {/* ── ما أُرسل ─────────────────────────────────────────────────────── */}
      <Sheet className="rise mb-4">
        <SheetHead title="ما أُرسل" meta="كل إرسالة في بطاقة، ومعها من وصلته" />
        {messages.length === 0 ? (
          <Empty icon={Megaphone} title="لا رسائل بعد"
            body="ما ترسله هنا يظهر في تنبيهات من أرسلته إليه، ويبقى أسبوعين." />
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id}
                className="rounded-xl border border-ink-150 bg-page/40 px-4 py-3">
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-body leading-relaxed text-ink-900">{m.body}</p>
                  <button type="button" onClick={() => withdraw(m.id)}
                    disabled={busy === m.id} aria-label="اسحب الرسالة"
                    className="press shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-risk-100 hover:text-risk-700 disabled:opacity-40">
                    {busy === m.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Trash2 size={15} strokeWidth={1.9} />}
                  </button>
                </div>

                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-ink-500">
                  <Chip tone={m.audience === 'STUDENTS' ? 'info' : 'ok'}>
                    {m.audience === 'STUDENTS' ? 'الطلاب' : 'المعلمون'}
                  </Chip>
                  {m.scopeLabel && <Chip tone="brand">{m.scopeLabel}</Chip>}
                  <span>· <Num>{m.sent}</Num> نسخة</span>
                  <span>· قرأها <Num className="font-medium text-ink-700">{m.read}</Num></span>
                  <span>· {relativeDay(m.at.slice(0, 10))}</span>
                  {m.byName && <span>· {m.byName}</span>}
                </p>

                {/* لمن أُرسلت — a few names, and the rest behind one tap. */}
                {m.names.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-micro text-ink-600">
                    <span className="text-ink-500">إلى:</span>
                    {(openNames === m.id ? m.allNames : m.names).map((n, i) => (
                      <span key={`${n}-${i}`} className="rounded bg-ink-100 px-1.5 py-0.5">{n}</span>
                    ))}
                    {m.more > 0 && (
                      <button type="button" className="press underline"
                        onClick={() => setOpenNames(openNames === m.id ? null : m.id)}>
                        {openNames === m.id ? 'أخفِ' : <>عرض الكل (<Num>{m.more}</Num>)</>}
                      </button>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}

/* ── قائمة قصيرة، ظاهرة كلها ─────────────────────────────────────────────────
   «أظهر الحلقات كلهم في أقراص مستطيلة» و«قائمة المعلمين تكون ظاهرة جميعها»
   (client, 18 Sep 2026).

   A rectangle that toggles, with nothing behind a search: nine halaqat or eight
   teachers make a list shorter than the dropdown that would have covered it,
   and seeing them all at once is how a supervisor notices the one he meant to
   include. Each carries its own count, because «إلى الحلقتين» is a decision
   about how many boys it reaches. */
function Picker({ items, picked, onChange, empty, hint }: {
  items: { id: string; label: string; meta?: string | null; n?: number }[];
  picked: string[];
  onChange: (next: string[]) => void;
  empty: string;
  hint: string;
}) {
  const toggle = (id: string) =>
    onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <div className="mt-3 rounded-xl border border-ink-150 bg-page/40 p-3">
      <p className="mb-2 flex items-center justify-between gap-3 text-micro text-ink-500">
        <span>{hint}</span>
        {picked.length > 0 && (
          <button type="button" className="press underline" onClick={() => onChange([])}>
            امسح الاختيار (<Num>{picked.length}</Num>)
          </button>
        )}
      </p>

      {items.length === 0 ? (
        <p className="text-panel text-ink-500">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => {
            const on = picked.includes(it.id);
            return (
              <button key={it.id} type="button" onClick={() => toggle(it.id)}
                aria-pressed={on}
                className={cx('press flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-panel transition-colors',
                  on ? 'border-brand-700 bg-brand-100 font-medium text-brand-800'
                     : 'border-ink-200 bg-paper text-ink-700 hover:border-ink-300')}>
                <span className="w-3.5 shrink-0">
                  {on && <Check size={14} strokeWidth={2.6} />}
                </span>
                {it.label}
                {it.meta && <span className="text-micro text-ink-500">· {it.meta}</span>}
                {it.n != null && (
                  <Num className={cx('text-micro', on ? 'text-brand-700' : 'text-ink-400')}>
                    {it.n}
                  </Num>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── البحث عن أسماء بأعيانها ─────────────────────────────────────────────────
   «خانة بحث تظهر الأسماء في قائمة منسدلة بعد كتابة حرفين، وتحديد الاسم والتنقل
   فيها، وتظهر أسماء الطلاب الذين تم تحديدهم» (client, 18 Sep 2026).

   A hundred and seventeen chips is not a list anyone reads, and a wall of them
   is slower than typing three letters. So nothing appears until two letters
   narrow it, ↑↓ walk the hits, Enter takes one, and what has been taken shows
   as chips underneath — the only place the chosen names belong, because that is
   the answer to «من اخترت؟». */
function NamePicker({ people, picked, onChange }: {
  people: { id: string; fullName: string; meta: string | null }[];
  picked: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const chosen = useMemo(
    () => picked.map((id) => people.find((p) => p.id === id)).filter(Boolean) as typeof people,
    [picked, people]);

  const hits = useMemo(() => {
    const needle = foldArabic(q.trim());
    if (needle.length < MIN_QUERY) return [];
    return people
      .filter((p) => !picked.includes(p.id) && foldArabic(p.fullName).includes(needle))
      .slice(0, HITS);
  }, [q, people, picked]);

  useEffect(() => { setAt(0); }, [q]);

  const take = (id: string) => { onChange([...picked, id]); setQ(''); };

  return (
    <div ref={box} className="mt-3 rounded-xl border border-ink-150 bg-page/40 p-3">
      <span className="relative block">
        <Search size={15}
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب حرفين من الاسم" aria-label="ابحث بالاسم"
          autoComplete="off"
          onKeyDown={(e) => {
            if (!hits.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => (i + 1) % hits.length); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => (i - 1 + hits.length) % hits.length); }
            if (e.key === 'Enter') { e.preventDefault(); take(hits[at].id); }
            if (e.key === 'Escape') setQ('');
          }}
          className={cx(INPUT_BARE, 'h-10 w-full pe-9')} />

        {/* القائمة المنسدلة — only once the search has narrowed it. */}
        {q.trim().length >= MIN_QUERY && (
          <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-ink-150 bg-paper shadow-pop">
            {hits.length === 0 ? (
              <p className="px-3 py-2.5 text-panel text-ink-500">لا نتائج</p>
            ) : hits.map((p, i) => (
              <button key={p.id} type="button"
                onMouseEnter={() => setAt(i)} onClick={() => take(p.id)}
                className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-start transition-colors',
                  i === at ? 'bg-brand-50' : 'hover:bg-page')}>
                <span className="truncate text-panel text-ink-900">{p.fullName}</span>
                {p.meta && <span className="shrink-0 text-micro text-ink-500">{p.meta}</span>}
              </button>
            ))}
          </div>
        )}
      </span>

      {chosen.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {chosen.map((p) => (
            <span key={p.id}
              className="flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-100 px-2 py-1 text-panel text-brand-800">
              {p.fullName}
              <button type="button" aria-label={`احذف ${p.fullName}`}
                onClick={() => onChange(picked.filter((x) => x !== p.id))}
                className="press rounded p-0.5 text-brand-800/70 hover:text-brand-900">
                <X size={13} strokeWidth={2.4} />
              </button>
            </span>
          ))}
          <button type="button" className="press ms-1 text-micro text-ink-500 underline"
            onClick={() => onChange([])}>امسح الاختيار</button>
        </div>
      ) : (
        <p className="mt-2.5 text-micro text-ink-500">لم تختر أحدًا بعد.</p>
      )}
    </div>
  );
}
