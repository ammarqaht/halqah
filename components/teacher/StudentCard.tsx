'use client';
/* ─────────────────────────────────────────────────────────────────────────────
   بطاقة الطالب في صفحة التسجيل — مع-٣-ب و مع-٣-ج.

   «الطلاب كلهم في صفحة واحدة، بطاقة تحت بطاقة، لا بطاقة واحدة ينتقل بينها
   بالتالي — فالمعلم يسمّع لطالب ثم لآخر ثم يعود إلى الأول إن سمّع عنده بقية
   مقرّره، وهذا هو الواقع في الحلقة.»

   Reworked 18 Sep 2026 on the client's own reading of it:

     · التحضير is ONE ROW — حاضر · متأخر · غائب — with الثوب on the same row
       behind a hairline, because it is a different question about the same boy.
     · Pressing the chosen state again CLEARS it. A teacher who tapped the wrong
       name needs a way back that is not a page reload.
     · التسميع does not appear until he is marked present. An untouched card
       shows one decision, not four.
     · The lines say what they are — «المراجعة الكبرى» — rather than م.ك. There
       is a whole row; the abbreviation is for printed columns.
     · The WHOLE line toggles, not the tick. A thumb aimed at a 36px box between
       twenty-five cards misses; a thumb aimed at the row does not.
     · Each line carries its own note, beside the passage it is about.

   «لا درجة ولا تقييم» still holds, and so does «ولا نقاط ولا حسابات في هذه
   الصفحة: هي صفحة تسجيل لا صفحة تقييم».
   ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from 'react';
import {
  AlertTriangle, Award, Check, ChevronDown, Loader2, MessageSquarePlus, Minus,
  Plus, Shirt,
} from 'lucide-react';
import { Num } from '@/components/Num';
import { Btn, Modal } from '@/components/ui';
import {
  COPY, KIND_FULL_AR, STATUSES, STATUS_SHAPE, type StatusCode,
} from '@/content/teacher';
import {
  MAX_ERRORS, dailyAward, type DailyPointItems,
} from '@/lib/teacher';
import type { PlanKind, Track } from '@/lib/types';
import { Combobox } from '@/components/Combobox';
import { SURAHS, ayahCount, findSurah } from '@/lib/surahs';
import { cx } from '@/lib/cx';

/** The halaqa's point table, as the day and period routes hand it down. */
export type DailyTable = { items: DailyPointItems; golden: DailyPointItems };

export type CardLine = {
  kind: 'DARS' | 'MURAJAA_SUGHRA' | 'MURAJAA_KUBRA';
  kindAr: string;
  fromSurah: string; fromAyah: string; toSurah: string; toAyah: string;
  recited: boolean;
  errors: number;
  note: string;
};

export type Card = {
  studentId: string;
  fullName: string;
  track: string | null;
  trackAr: string | null;
  level: number | null;
  assignmentNo: number | null;
  assignmentOf: number;
  awaitingExam: 'BADGE_GOLDEN' | 'BADGE_DIAMOND' | null;
  reason: 'OK' | 'TALQEEN' | 'NO_PLAN' | 'NO_ASSIGNMENT' | 'AWAITING_EXAM';
  lines: CardLine[];
  status: StatusCode | null;
  thobe: boolean;
  note: string;
  incomplete: boolean;
  savedAt: string | null;
  savedByName: string;
  savedByRole: string;
  points: number;
  /** مسار التلقين وحده — أين وقف، وما سُجِّل له اليوم. */
  talqeen?: { from: string; surah: string; ayah: number | null };
};

export type LineDraft = { recited: boolean; errors: number; note: string };

export type Draft = {
  status: StatusCode | null;
  thobe: boolean;
  note: string;
  lines: Record<string, LineDraft>;
  /** آخر سورة قرأها وآخر آية حفظها — التلقين وحده. */
  talqeenSurah?: string;
  talqeenAyah?: string;
};

export type SaveState = 'CLEAN' | 'DIRTY' | 'SAVING' | 'SAVED' | 'QUEUED' | 'ERROR';

export const draftOf = (c: Card): Draft => ({
  status: c.status,
  thobe: c.thobe,
  note: c.note,
  lines: Object.fromEntries(c.lines.map((l) => [l.kind,
    { recited: l.recited, errors: l.errors, note: l.note }])),
  talqeenSurah: c.talqeen?.surah ?? '',
  talqeenAyah: c.talqeen?.ayah != null ? String(c.talqeen.ayah) : '',
});

const TONE: Record<StatusCode, string> = {
  PRESENT: 'border-ok-500 bg-ok-100 text-ok-700',
  LATE:    'border-warn-500 bg-warn-100 text-warn-700',
  ABSENT:  'border-risk-500 bg-risk-100 text-risk-700',
};

export function StudentCard({
  card, draft, state, error, daily, rise, nameless, onChange, onSave,
}: {
  card: Card;
  draft: Draft;
  state: SaveState;
  error?: string;
  /** The halaqa's own point table. Absent only while the day is loading, and
      then the box waits rather than showing a figure from the defaults. */
  daily?: DailyTable;
  /** Milliseconds into the screen's entrance. The cards arrive one after
      another rather than all at once — «دخولية سلسة كسائر الصفحات». */
  rise?: number;
  /** Drop the name from the head. In وضع «فترة لطالب» the column is DAYS for one
      boy, and his name on all fourteen cards is fourteen copies of something the
      screen said once at the top — «فهو طالب واحد» (client, 18 Sep 2026). */
  nameless?: boolean;
  onChange: (next: Draft) => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(true);
  /* Which line's note modal is open, if any. */
  const [noteOn, setNoteOn] = useState<string | null>(null);

  const away = draft.status === 'ABSENT';
  /* «تفاصيل التسميع لا تظهر إلا بعد تحديد حالة حضور الطالب» — and never for a
     boy who is away: «والغائب تُغلق خانات تسميعه، ولا يُحسب عليه شيء». */
  const canRecite = card.reason === 'OK' && draft.status !== null && !away;
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  /* How many ayat the named surah has, so «آخر آية» can be checked by eye. */
  const ayahs = card.reason === 'TALQEEN' ? ayahCount(draft.talqeenSurah ?? '') : null;
  /* «إذا المعلم كتب سورة ليست من ضمن القائمة يظهر تنبيه» (client, 18 Sep 2026).
     The server matches the name against the 114 before it becomes a position,
     so a misspelling is DROPPED rather than stored — and a field that quietly
     drops what was typed into it is worse than one that refuses it. This says
     so on the card, while he can still fix it. */
  const surahOff = !!(draft.talqeenSurah ?? '').trim() && !findSurah(draft.talqeenSurah);

  const recited = card.lines.filter((l) => draft.lines[l.kind]?.recited).length;
  const noted = card.lines.filter((l) => draft.lines[l.kind]?.note?.trim()).length;
  const line = card.lines.find((l) => l.kind === noteOn);

  /* «إجمالي النقاط، وهي النقاط اللي حصل عليها الطالب اليوم» (client, 18 Sep
     2026) — computed from the DRAFT and not from what is saved, so the figure
     answers the tick the teacher just made rather than the card he opened. The
     same `dailyAward` the server pays him by, over the same table the server
     read, so the box and the ledger cannot drift apart.

     A boy on مسار التلقين and one whose track is unknown have no box at all:
     «مسار التلقين — حضور فقط، بلا مقرّر ولا نقاط», and a permanent ٠ beside the
     save button reads as a score rather than as a rule. */
  const earns = !!card.track && card.track !== 'TALQEEN';
  const points = useMemo(() => (daily && earns
    ? dailyAward({
        track: card.track as Track,
        status: draft.status ?? '',
        thobe: draft.thobe,
        lines: card.lines.map((l) => ({
          kind: l.kind as PlanKind,
          recited: draft.lines[l.kind]?.recited ?? false,
          errors: draft.lines[l.kind]?.errors ?? 0,
        })),
        items: daily.items, golden: daily.golden,
      }).total
    : 0), [daily, earns, card.track, card.lines, draft.status, draft.thobe, draft.lines]);

  return (
    <li style={rise != null ? { animationDelay: `${rise}ms` } : undefined}
      className={cx('rounded-2xl border bg-paper shadow-soft transition-colors',
        rise != null && 'rise',
        state === 'ERROR' ? 'border-risk-300'
          : state === 'SAVED' || state === 'CLEAN' ? 'border-ink-150'
          : state === 'QUEUED' ? 'border-warn-200' : 'border-brand-200')}>

      {/* ── the head: name, where he is, and what has been saved ──────────── */}
      <div className="flex items-start gap-3 px-[18px] pb-2.5 pt-3.5">
        <div className="min-w-0 flex-1">
          {!nameless && (
            <p className="truncate text-lg2 font-medium leading-snug text-ink-900">
              {card.fullName}
            </p>
          )}
          <p className={cx('flex flex-wrap items-center gap-x-1.5 text-xs2 text-ink-500',
            nameless ? 'text-sm2' : 'mt-0.5')}>
            {card.trackAr && <span>المسار {card.trackAr}</span>}
            {card.level != null && <span>· المستوى <Num>{card.level}</Num></span>}
            {card.assignmentNo != null && card.assignmentOf > 0 && (
              <span className="font-medium text-brand-800">
                · المقرّر <Num>{card.assignmentNo}</Num> من <Num>{card.assignmentOf}</Num>
              </span>
            )}
          </p>
        </div>

        <SaveMark state={state} savedAt={card.savedAt}
          by={card.savedByRole === 'SUPERVISOR' ? card.savedByName : ''} />
      </div>

      {/* ── التحضير — one row, and الثوب behind a hairline ────────────────── */}
      <div className="flex items-stretch gap-1.5 px-[18px] pb-3">
        {STATUSES.map((s) => {
          const on = draft.status === s.code;
          return (
            <button key={s.code} type="button"
              /* «إعادة الضغط على حالة الحضور تلغي التحضير» — the same tap that
                 set it clears it, and the card goes back to undecided. */
              onClick={() => set(on
                ? { status: null, thobe: false }
                : { status: s.code, thobe: s.code === 'ABSENT' ? false : draft.thobe })}
              aria-pressed={on}
              className={cx('press flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl border-2 text-panel font-medium transition-colors',
                on ? TONE[s.code] : 'border-ink-150 bg-page text-ink-600')}>
              <span aria-hidden className="text-[11px] leading-none">{STATUS_SHAPE[s.code]}</span>
              {s.short}
            </button>
          );
        })}

        {/* The hairline: الثوب is a different question, on the same row. */}
        <span aria-hidden className="mx-0.5 w-px shrink-0 self-stretch bg-ink-200" />

        <button type="button"
          onClick={() => set({ thobe: !draft.thobe })}
          aria-pressed={draft.thobe}
          aria-label="الثوب"
          disabled={!draft.status || away}
          className={cx('press flex min-h-[46px] w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[11px] font-medium transition-colors disabled:opacity-40',
            draft.thobe ? 'border-brand-600 bg-brand-100 text-brand-800'
                        : 'border-ink-150 bg-page text-ink-600')}>
          <Shirt size={15} strokeWidth={1.9} />الثوب
        </button>
      </div>

      {/* ── why this card has no lines, when it has none ──────────────────── */}
      {card.reason !== 'OK' && (
        <div className="mx-[18px] mb-3 flex items-start gap-2 rounded-xl border border-ink-150 bg-page px-3.5 py-2.5">
          {card.reason === 'AWAITING_EXAM'
            ? <Award size={15} className="mt-0.5 shrink-0 text-warn-700" strokeWidth={1.9} />
            : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-ink-400" strokeWidth={1.9} />}
          <div className="min-w-0 flex-1">
            {card.reason === 'NO_ASSIGNMENT' ? (
              <>
                <p className="text-sm2 font-medium text-ink-800">{COPY.noAssignment}</p>
                <p className="mt-0.5 text-xs2 leading-relaxed text-ink-600">
                  {COPY.noAssignmentBody}
                </p>
              </>
            ) : (
              <p className="text-sm2 leading-relaxed text-ink-700">
                {card.reason === 'TALQEEN' ? 'مسار التلقين — بلا مقرّر ولا نقاط، ويُسجَّل موضعه'
                  : card.reason === 'NO_PLAN' ? 'لم تُصدر خطته بعد — حضور وثوب فقط'
                  : 'يستحق الاختبار — راجع المشرف، ويبقى على مقرّره حتى تُسجَّل نتيجته'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── موضع التلقين ─────────────────────────────────────────────────────
          «طلاب التلقين … يسجّل لهم المعلم آخر سورة قرأوها وآخر آية حفظوها، وفي
          اليوم التالي يعرض من أين يبدأ» (client, 18 Sep 2026).

          A talqeen boy has no plan and no مقرّر — «لا مستوى له ولا منهج» — so his
          card carried one decision and then stopped, and nothing in the system
          remembered where his teacher had left him. It does now, and the line
          above the fields is the whole point of it: the teacher reads «يبدأ من»
          before either of them opens a mushaf.

          Behind the attendance, like التسميع: there is nothing to write down
          about a boy who was not there. */}
      {card.reason === 'TALQEEN' && card.talqeen && draft.status !== null && !away && (
        <div className="border-t border-ink-150 px-[18px] py-3">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm2">
            <span className="text-ink-500">يبدأ من</span>
            <span className="font-medium text-brand-800">{card.talqeen.from}</span>
          </p>

          <div className="mt-2.5 flex flex-wrap items-end gap-2">
            <div className="min-w-[9rem] flex-1">
              <span className="mb-1 block text-micro text-ink-500">آخر سورة قرأها</span>
              {/* The 114 in the site's own list, so a name is CHOSEN rather than
                  spelled — the native datalist that was here rendered in the
                  operating system's style and could not be walked from the
                  keyboard. Typing still works, and what is typed is kept
                  visible: a name is only refused out loud, never swallowed. */}
              <Combobox value={draft.talqeenSurah ?? ''}
                onChange={(v) => set({ talqeenSurah: v })}
                options={SURAHS.map((x) => ({ value: x.name, label: x.name }))}
                placeholder="اختر السورة" searchPlaceholder="اكتب اسم السورة"
                emptyText="لا سورة بهذا الاسم"
                creatable createLabel="كما كُتب:"
                className="!h-10 !rounded-lg !px-3 !text-sm2" />
            </div>

            <label className="w-24">
              <span className="mb-1 block text-micro text-ink-500">آخر آية حفظها</span>
              <input inputMode="numeric" value={draft.talqeenAyah ?? ''}
                onChange={(e) => set({ talqeenAyah: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                placeholder="—"
                className="h-10 w-full rounded-lg border border-ink-200 bg-paper px-2 text-center text-sm2 tabular-nums text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
            </label>

            {ayahs != null && (
              <span className="pb-2.5 text-micro text-ink-500">
                من <Num>{ayahs}</Num>
              </span>
            )}
          </div>

          {surahOff && (
            <p role="alert"
              className="mt-2 flex items-start gap-2 rounded-lg border border-warn-200 bg-warn-100 px-3 py-2 text-micro leading-relaxed text-warn-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                «{(draft.talqeenSurah ?? '').trim()}» ليست من السور الـ<Num>114</Num> —
                اخترها من القائمة، وإلا لن يُحفظ الموضع.
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── التسميع — only once he is marked present ──────────────────────── */}
      {card.reason === 'OK' && card.lines.length > 0 && (
        draft.status === null ? (
          <p className="border-t border-ink-150 px-[18px] py-2.5 text-panel text-ink-400">
            {COPY.pickStatusFirst}
          </p>
        ) : canRecite ? (
          <div className="border-t border-ink-150">
            <button type="button" onClick={() => setOpen(!open)}
              className="flex w-full items-center justify-between gap-3 px-[18px] py-2.5 text-start">
              <span className="text-panel font-medium text-ink-700">
                التسميع
                {recited > 0 && (
                  <span className="ms-1.5 text-brand-800">
                    — <Num>{recited}</Num> من <Num>{card.lines.length}</Num>
                  </span>
                )}
                {noted > 0 && (
                  <span className="ms-1.5 text-ink-400">· <Num>{noted}</Num> ملاحظة</span>
                )}
              </span>
              <ChevronDown size={16} strokeWidth={2}
                className={cx('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
              <div className="space-y-1.5 px-[18px] pb-3">
                {card.lines.map((l) => (
                  <Line key={l.kind} line={l}
                    value={draft.lines[l.kind] ?? { recited: false, errors: 0, note: '' }}
                    onChange={(v) => set({ lines: { ...draft.lines, [l.kind]: v } })}
                    onNote={() => setNoteOn(l.kind)} />
                ))}

                <label className="mt-2 block">
                  <span className="mb-1 block text-micro text-ink-500">{COPY.noteLabel}</span>
                  <input value={draft.note} onChange={(e) => set({ note: e.target.value })}
                    placeholder={COPY.notePlaceholder} maxLength={280}
                    className="h-10 w-full rounded-lg border border-ink-200 bg-paper px-3 text-sm2 text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
                </label>
              </div>
            )}
          </div>
        ) : null
      )}

      {/* ── حفظ، وإجمالي نقاط يومه ───────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-t border-ink-150 px-[18px] py-2.5">
        {/* First child, so in RTL it sits at the RIGHT end of the save row —
            «في الجهة اليمنى منها على نفس سطر زر الحفظ». §١٢-ب's «ولا نقاط ولا
            حسابات في هذه الصفحة» is reversed here on the client's own reading:
            he asked for the day's total on the card. It stays a READOUT — there
            is still nothing to grade and nothing to type into. */}
        {earns && daily && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-ink-150 bg-page px-2.5 py-1.5"
            title="نقاط هذا اليوم — تُحسب مما عُلِّم في البطاقة">
            <span className="text-micro leading-none text-ink-500">نقاط يومه</span>
            <Num className={cx('font-display text-lg2 leading-none tabular-nums',
              points > 0 ? 'text-ink-900' : 'text-ink-400')}>
              {points}
            </Num>
          </span>
        )}

        {error && (
          <p className="min-w-0 flex-1 text-xs2 leading-snug text-risk-700">{error}</p>
        )}
        {!error && card.incomplete && (
          <p className="min-w-0 flex-1 text-xs2 text-warn-700">
            يومه ناقص — سمّع درسه دون مراجعته
          </p>
        )}
        {!error && !card.incomplete && <span className="min-w-0 flex-1" />}

        {/* «إذا شلت تحضير اليوم المفروض إنه يمديني أحفظ التعديل» — clearing a
            SAVED card is an edit like any other, and the button must take it:
            it deletes the day's record, pulls its points back with a correction
            row, and returns the boy to the مقرّر he was on. What stays disabled
            is a card that was never saved and has nothing chosen — there is
            nothing there to write. */}
        <Btn variant={state === 'DIRTY' || state === 'ERROR' ? 'primary' : 'default'}
          size="md"
          disabled={(!draft.status && !card.savedAt) || state === 'SAVING' || state === 'CLEAN'}
          onClick={onSave} className="min-w-[92px] shrink-0">
          {state === 'SAVING' ? <><Loader2 size={16} className="animate-spin" />{COPY.saving}</>
            : state === 'SAVED' ? <><Check size={16} strokeWidth={2.4} />{COPY.saved}</>
            /* «زرّ امسح تسجيله لا يظهر إلا في وقته» — and its time is one case:
               a card that WAS saved and has just been cleared. It used to read
               from `!draft.status` alone, which is also true of every untouched
               card on the screen, so twenty-five cards offered to erase a day
               nobody had written yet. */
            : card.savedAt && !draft.status ? COPY.clearDay
            : COPY.save}
        </Btn>
      </div>

      {/* ── ملاحظة على المقرّر ───────────────────────────────────────────── */}
      <Modal open={!!line} onClose={() => setNoteOn(null)}
        title={line ? `${COPY.lineNote} — ${KIND_FULL_AR[line.kind] ?? line.kindAr}` : ''}
        footer={<Btn variant="primary" onClick={() => setNoteOn(null)}>تم</Btn>}>
        {line && (
          <>
            <p className="mb-3 text-xs2 text-ink-500">
              {card.fullName}
              {card.assignmentNo != null && <> · المقرّر <Num>{card.assignmentNo}</Num></>}
              {line.fromSurah && (
                <> · {line.fromSurah} <Num>{line.fromAyah}</Num> ← {line.toSurah}{' '}
                  <Num>{line.toAyah}</Num></>
              )}
            </p>
            <textarea
              value={draft.lines[line.kind]?.note ?? ''}
              onChange={(e) => set({
                lines: {
                  ...draft.lines,
                  [line.kind]: {
                    ...(draft.lines[line.kind] ?? { recited: false, errors: 0, note: '' }),
                    note: e.target.value,
                  },
                },
              })}
              rows={4} maxLength={280} autoFocus
              placeholder={COPY.lineNotePlaceholder}
              className="w-full rounded-lg border border-ink-200 bg-paper px-3 py-2.5 text-base2 leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none" />
            <p className="mt-2 text-micro text-ink-500">
              تظهر في ملف الطالب بجانب مقرّرها، ويراها المشرف.
            </p>
          </>
        )}
      </Modal>
    </li>
  );
}

/**
 * One line: سورته وآياته، سمّع/لم يسمّع، وعدد الأخطاء، وملاحظته.
 *
 * The whole block is the button — «لتغيير حالة التسميع عليه الضغط على البلوك
 * كامل، مش بس خانة الزر». The errors stepper and the note button sit inside it
 * and stop the click from reaching it, so a thumb aimed at `+` does not also
 * mark the line recited.
 */
function Line({ line, value, onChange, onNote }: {
  line: CardLine;
  value: LineDraft;
  onChange: (v: LineDraft) => void;
  onNote: () => void;
}) {
  const range = [line.fromSurah, line.fromAyah, line.toSurah, line.toAyah];
  const has = range.some((x) => String(x ?? '').trim());
  const bump = (by: number) =>
    onChange({ ...value, errors: Math.max(0, Math.min(MAX_ERRORS, value.errors + by)) });
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); };

  return (
    <div role="button" tabIndex={0}
      aria-pressed={value.recited}
      aria-label={`${KIND_FULL_AR[line.kind] ?? line.kindAr} — ${value.recited ? 'سمّع' : 'لم يسمّع'}`}
      onClick={() => onChange({ ...value, recited: !value.recited })}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange({ ...value, recited: !value.recited });
        }
      }}
      className={cx('press cursor-pointer rounded-xl border-2 px-3 py-2.5 transition-colors',
        value.recited ? 'border-brand-600 bg-brand-50' : 'border-ink-150 bg-page')}>

      {/* ONE LINE, and the text shrinks before it wraps — «بطاقات صفوف التسميع
          تكون سطر واحد ولو صغرت النص» (client, 18 Sep 2026). The name never
          shrinks below legibility; it is the passage that gives way, because a
          teacher reading «المراجعة الكبرى» knows which passage that is. */}
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden
          className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
            value.recited ? 'border-brand-700 bg-brand-800 text-white'
                          : 'border-ink-200 bg-paper text-ink-300')}>
          <Check size={13} strokeWidth={3} />
        </span>

        <span className="shrink-0 whitespace-nowrap text-panel font-medium text-ink-900">
          {KIND_FULL_AR[line.kind] ?? line.kindAr}
        </span>

        <span className="min-w-0 flex-1 truncate text-end text-micro text-ink-500">
          {has ? (
            <>
              {line.fromSurah} <Num>{line.fromAyah}</Num>
              {' ← '}
              {line.toSurah} <Num>{line.toAyah}</Num>
            </>
          ) : 'لم تُرفع سوره'}
        </span>
      </div>

      {/* الأخطاء — labelled, because an unlabelled number box beside a tick is
          a number nobody is sure of. A stepper, not a keyboard: a teacher
          counting while a boy recites taps. The field stays for the day it
          was eleven. */}
      <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-ink-150/70 pt-2.5"
        onClick={stop} onKeyDown={(e) => e.stopPropagation()} role="presentation">
        <div>
          <span className="mb-1 block text-micro text-ink-500">{COPY.errorsLabel}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => bump(-1)} aria-label="أنقص خطأ"
              disabled={value.errors === 0}
              className="press grid h-8 w-8 place-items-center rounded-lg border border-ink-200 bg-paper text-ink-600 disabled:opacity-40">
              <Minus size={14} strokeWidth={2.2} />
            </button>
            <input value={value.errors} inputMode="numeric" aria-label={COPY.errorsLabel}
              onChange={(e) => onChange({
                ...value,
                errors: Math.max(0, Math.min(MAX_ERRORS,
                  Math.trunc(Number(e.target.value.replace(/\D/g, '')) || 0))),
              })}
              className="h-8 w-11 rounded-lg border border-ink-200 bg-paper text-center text-panel tabular-nums text-ink-900 focus:border-brand-700 focus:outline-none" />
            <button type="button" onClick={() => bump(1)} aria-label="زد خطأ"
              disabled={value.errors >= MAX_ERRORS}
              className="press grid h-8 w-8 place-items-center rounded-lg border border-ink-200 bg-paper text-ink-600 disabled:opacity-40">
              <Plus size={14} strokeWidth={2.2} />
            </button>

            {/* The note, beside the stepper — one tap from the line it is about. */}
            <button type="button" onClick={onNote} aria-label={COPY.lineNote}
              className={cx('press ms-1 grid h-8 w-8 place-items-center rounded-lg border transition-colors',
                value.note.trim()
                  ? 'border-brand-600 bg-brand-100 text-brand-800'
                  : 'border-ink-200 bg-paper text-ink-500')}>
              <MessageSquarePlus size={15} strokeWidth={1.9} />
            </button>
          </div>
        </div>

        {value.note.trim() && (
          <p className="min-w-0 flex-1 truncate pb-1 text-end text-micro text-ink-500"
            title={value.note}>
            {value.note}
          </p>
        )}
      </div>
    </div>
  );
}

function SaveMark({ state, savedAt, by }: {
  state: SaveState; savedAt: string | null; by: string;
}) {
  if (state === 'SAVING') {
    return <Loader2 size={17} className="mt-1 shrink-0 animate-spin text-brand-700" />;
  }
  if (state === 'QUEUED') {
    return (
      <span className="mt-0.5 shrink-0 rounded-full bg-warn-100 px-2 py-1 text-[10.5px] font-medium text-warn-700">
        في الانتظار
      </span>
    );
  }
  if (state === 'DIRTY' || state === 'ERROR') {
    return (
      <span className="mt-0.5 shrink-0 rounded-full bg-brand-100 px-2 py-1 text-[10.5px] font-medium text-brand-800">
        لم يُحفظ
      </span>
    );
  }
  if (!savedAt) return <span className="mt-1 shrink-0 text-[10.5px] text-ink-400">—</span>;
  return (
    <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-ok-100 px-2 py-1 text-[10.5px] font-medium text-ok-700">
      <Check size={12} strokeWidth={2.6} />
      {by ? `حُفظ — ${by}` : 'محفوظ'}
    </span>
  );
}
