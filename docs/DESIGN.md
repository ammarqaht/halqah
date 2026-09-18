# Halqah — Design System & Application Shell

> Companion to **`SPEC.md`** (what the system does) and **`BUILD_PLAN.md`** (when we build it).
> This file locks **how it looks and how it is navigated**. Approved 29 Aug 2026.
>
> Nothing here is invented. Every token is either measured from the client's logo files or
> carried over from one of three approved mockups. Provenance is stated for each decision.

---

## 0. Provenance — what came from where

| Source | Path | What we took |
|---|---|---|
| Mockup A | `~/Desktop/halaqa/` | **Sign-in page structure** — the two-column split, the lattice motif, the ayah block |
| Mockup B | `~/Desktop/halaqah-v4/` | **Application shell** — icon rail + contextual panel, and table density |
| Mockup C | `~/Desktop/halaqah-mockup/dist-editorial/` | **Palette and typography** |
| Client logos | `Halqah/assets/masjid.png`, `jamiyah.png` | **The palette's origin** — sampled, not guessed |

**Deliberately not taken:** all three mockups were drawn for a wider product than the one the client
approved. They contain التحضير (attendance), التسميع (recitation logging), and a ولي الأمر portal.
Our approved scope keeps attendance and recitation in **Ratel** and has no guardian portal in phase 1
(see `SPEC.md` §0 and the client-approved PDF §12). Those screens are removed, not deferred-in-place —
see §6 for the corrected navigation map.

> **Amended 17 Sep 2026.** التحضير and التسميع came back — not to the supervisor's surface, where
> the mockups had drawn them, but as a portal of their own: «متطلبات بوابة المعلم — النسخة الثالثة»
> makes them a teacher's daily work and takes Ratel out of his hands entirely. The paragraph above
> stands for the supervisor: he still only READS attendance and recitation. See **§12**.

---

## 1. Palette

### 1.1 Origin
Sampled from the client's own logo files at full resolution:

| Source | Hex | HSL | Role |
|---|---|---|---|
| حلقات جامع محمد العبدالكريم | **`#0E8D83`** | 175° · 84% · 29% | **The brand.** Everything below derives from this hue |
| جمعية تحفيظ الشرقية — كحلي | `#1B1C57` | 240° · 56% · 21% | Association surfaces only |
| جمعية تحفيظ الشرقية — أزرق فاتح | `#5AB8DE` | 196° · 67% · 61% | Association accent only |

The mosque teal is *exactly* the `brand-700` already used across the mockups — the editorial palette
was derived from this logo. The choice is self-consistent.

### 1.2 Tokens

```js
// tailwind.config.js — theme.extend.colors
page:  '#F4F5F1',   // application ground. warm stone, never pure white
paper: '#FAFBF8',   // raised surface: sheets, panel, sticky bars, inputs

ink: {              // text and rules — warm greys, not blue-greys
  900: '#191E1C',   // primary text        16.1:1 on page — AAA
  800: '#252B29',
  700: '#39423F',
  600: '#525C58',   // secondary text       7.2:1 — AAA
  500: '#6C7773',   // meta / placeholder   4.9:1 — AA
  400: '#8D9894',   // decorative only — never text
  300: '#B4BDB8',
  200: '#D6DCD6',   // hairlines
  150: '#E3E7E1',   // soft rules inside lists
  100: '#EAEEE8',
},

brand: {
  900: '#0A403C',   // THE RAIL GROUND + sign-in brand panel. white text 12.6:1 — AAA
  800: '#0B5F59',   // teal as text on light            5.6:1 — AA
  700: '#0E8D83',   // ← the logo. accent only: active indicator, focus ring, chart stroke
  600: '#3C9E96',
  400: '#7FBBB4',
  300: '#A9D0CB',
  200: '#CFE2DF',   // selection border
  100: '#E4EEEB',   // selection wash
  50:  '#EFF4F2',
},

sage: { 700: '#5E6F66', 500: '#7E8F86', 300: '#A8B5AC', 100: '#DFE5DF' },

// association-only — used on exam records and reports that leave the mosque
assoc: { 900: '#1B1C57', 700: '#2E3070', 300: '#5AB8DE', 100: '#E7F2F8' },

// status — desaturated. every one ALSO carries a shape (see §1.4)
ok:   { 700: '#3E6B54', 500: '#4E7C63', 200: '#CBDBD0', 100: '#E3EAE4' },
warn: { 700: '#7F6531', 500: '#9A7B3F', 200: '#E2D6BC', 100: '#F0EADC' },
info: { 700: '#4B5C77', 500: '#5C6E8A', 200: '#CBD3E0', 100: '#E5E9F0' },
risk: { 700: '#834B42', 500: '#9A5A50', 200: '#E0C9C4', 100: '#F0E4E1' },
```

### 1.3 Rules that are not negotiable
1. **`brand-700` is rationed.** It appears on the active-nav indicator, links, focus rings, one line
   on a chart, and the selection wash border. It is **never a wall of colour** and **never a text
   background** — white on raw `#0E8D83` is 4.1:1 and fails AA. Buttons fill with `brand-800`.
2. **`brand-900` is the only deep field in the product** — the rail and the sign-in brand panel.
   Everything else is light. The eye must always know which edge is navigation and which is work.
3. **`assoc.*` is reserved.** It marks records that came from the association (Qiyas imports,
   association exam rows, the statistics report header). Using it elsewhere destroys the signal.
4. Status text always renders at the `700` step so it clears 4.5:1 on `page` and on its own `100` wash.

### 1.4 Status shapes
Colour alone is never the carrier — these print in greyscale and are read by colour-blind users.

| Meaning | Colour | Shape |
|---|---|---|
| اجتاز / حاضر | `ok` | ✓ filled disc |
| متأخر / تحذير | `warn` | ◐ half-ring |
| معلومة | `info` | ▭ outlined square |
| لم يجتز / غائب | `risk` | ✕ hollow disc |

---

## 2. Typography

**Two families, both already licensed and installed for the Medad brand:**

| Family | Font | Weights | Where |
|---|---|---|---|
| `BrandArabic` | Thmanyah Sans | 400 · 500 · 700 | All UI: chrome, tables, forms, labels |
| `BrandDisplay` | Thmanyah Serif Display | 400 · 500 | **Reading surfaces only** (client decision) |

**Reading surfaces** = the sign-in screen · page titles (`h1`) · the student portal · printed reports
and plan sheets. **Everything else is sans** — admin table headers, card titles, panel groups, buttons,
form labels. The editorial character survives without slowing down dense work screens.

Fallback stack: `'SF Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, sans-serif`.
Self-host as subsetted `woff2` (Arabic + Latin digits + punctuation). Never a CDN.

### 2.1 Scale

```js
fontSize: {
  // ——— editorial scale — reading surfaces (display family for t1 and up)
  micro: ['11.5px', { lineHeight: '1.5', letterSpacing: '0.06em' }], // eyebrow labels
  xs2:   ['12.5px', { lineHeight: '1.6'  }],   // meta
  sm2:   ['13.5px', { lineHeight: '1.65' }],   // secondary rows
  base2: ['15px',   { lineHeight: '1.75' }],   // BODY on reading surfaces
  lg2:   ['17px',   { lineHeight: '1.6'  }],   // lede, emphasised body
  xl2:   ['19px',   { lineHeight: '1.5'  }],   // stat values
  t1:    ['24px',   { lineHeight: '1.35' }],   // display
  d2:    ['32px',   { lineHeight: '1.22' }],   // display — section headings
  d1:    ['40px',   { lineHeight: '1.14' }],   // display — page titles
  d0:    ['52px',   { lineHeight: '1.08' }],   // display — sign-in

  // ——— dense scale — tables and work surfaces (sans only)
  '2xs': ['10.5px', { lineHeight: '1.45', letterSpacing: '0.05em' }],
  cap:   ['12px',   { lineHeight: '1.5'  }],   // table captions
  panel: ['13px',   { lineHeight: '1.6'  }],   // contextual panel, table cells
  body:  ['14px',   { lineHeight: '1.65' }],   // BODY on work surfaces
  h3:    ['18px',   { lineHeight: '1.45' }],
  h2:    ['22px',   { lineHeight: '1.35' }],
  num:   ['32px',   { lineHeight: '1.1'  }],   // KPI figures only
}
```

**Weight does the hierarchy work:** 400 body · 500 emphasis · 700 headings. Nothing else.

### 2.2 Numerals — non-negotiable
- All figures `font-variant-numeric: tabular-nums`, so columns of pages and percentages align.
- **Bidi-isolate every numeric run.** Without it RTL reorders `4:45 – 6:15` into `6:15 – 4:45`
  and scrambles phone numbers. Ship a `<Num>` component that wraps its children in
  `<bdi dir="ltr" class="tabular-nums">` and use it for every number, date, time, and phone.
- Arabic-Indic digits (٠١٢٣) on **printed** output; Latin digits in inputs and tables.
- Arabic number agreement is handled by a helper: `خطأ واحد` · `خطآن` · `٣ أخطاء` · `١١ خطأ`;
  same for `طالب` / `طالبان` / `طلاب` / `طالبًا`.

---

## 3. Density — the hybrid (client decision)

Two densities, chosen per surface. This is deliberate, not an inconsistency.

| | Reading surfaces | Work surfaces |
|---|---|---|
| Where | Sign-in · overview · student profile · reports · student portal | Student list · plan editor · exam sheet · points ledger · store |
| Body | `base2` 15px / 1.75 | `body` 14px / 1.65 · cells `panel` 13px |
| Base unit | 24px — `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96` | 12px — `3 · 6 · 12 · 18 · 24 · 36 · 48` |
| Row height | — | 44–56px |
| Card padding | 24–32px | 18px |
| Headings | `BrandDisplay` | `BrandArabic` |

**Why:** 102 students in an airy table is endless scrolling; the 24-day plan grid has 72 rows.
Those need density. The overview and the student profile are read, not scanned — they get air.

---

## 4. The shell

Taken from Mockup B. Three tiers, right to left (RTL reading origin on the right).

```
┌──────────────────────────────────────────────────────────────┬────────┬──────┐
│                                                              │ PANEL  │ RAIL │
│                      WORK AREA                               │ 240px  │ 72px │
│   ┌────────────────────────────────────────────────────┐     │        │      │
│   │ TopBar — title · crumbs · panel toggle · actions    │     │ paper  │brand │
│   └────────────────────────────────────────────────────┘     │        │ -900 │
│                                                              │        │      │
│   page (#F4F5F1)                                             │        │      │
└──────────────────────────────────────────────────────────────┴────────┴──────┘
```

### Tier 1 — the rail (72px, `brand-900`, never collapses)
The spine. The one fixed landmark in the product.
- Icon-only. **No labels** — the supervisor memorises the map in week one and labels become dead
  weight. A tooltip appears on hover, `brand-900` background, to the *left* of the icon.
- Logo **mark** at the top (the square icon portion of the lockup, cropped from the same file —
  never redrawn, never recoloured), links to the overview.
- Active item: a `brand-700` pill behind the icon, plus a 3px indicator on the rail's right edge.
- Badge counts (e.g. pending orders) sit top-left of the icon in `brand-600`.
- Footer group above a hairline: settings, then sign out.
- At ≤768px the rail narrows to 56px and stays.

### Tier 2 — the contextual panel (240px, `paper`, collapsible)
**This is the idea worth stealing.** The panel is not a submenu — it **re-tools itself per section**,
so the supervisor filters and jumps without ever leaving the results:

| Section | What the panel becomes |
|---|---|
| الرئيسية | Jump list — alerts by type, with counts |
| الطلاب والحلقات | **The halaqat themselves** — add, edit, and filter by them — plus a stage filter, each with result counts. Track and status filters were removed: a halaqa is normally one track, and every student is active, so both were noise |
| الخطط | Student queue — who is waiting for a plan, who is late |
| الاختبارات | Booking queue for the day, and exam-type filter |
| النقاط والمتجر | **Built.** Screen switcher, then: the halaqa filter over the balances, the batch list over the cards, and order status + gift categories over the store |
| المتابعة | Saved lists — ready for association, late on level, not examined |
| التقارير | Report kind, scope, period |
| الإعدادات | Settings tabs |

- Collapses with the TopBar toggle when the table needs full width. State persists per section.
- **Mounted client-side only** (`app/admin/layout.tsx`). Its content comes entirely
  from the browser store, so the server has nothing truthful to render — but the
  reason is stronger than that. The per-section surfaces read `useSearchParams`,
  which makes Next mark the panel's Suspense boundary *postponed* during
  prerender. Routes whose page also opts out of static rendering resume it on the
  client; `/admin` stays fully static, so nothing ever resumed it and the panel
  sat on its skeleton forever after a hard load — the alerts surface with no
  alerts on it. Mounting after hydration creates the boundary in the browser,
  where it resolves at once.
- At ≤768px it becomes an overlay with a `brand-900/20` scrim.
- Panel type scale is `panel` 13px throughout. Groups are labelled with `2xs` uppercase-tracked
  `ink-500` eyebrows.

### Tier 3 — work area
Sticky `TopBar` (56px): page title, breadcrumbs, panel toggle, search, and **exactly one primary
action** per screen. Then the scrolling content on `page`.

---

## 5. Sign-in

Structure from Mockup A, palette and type from Mockup C, plus the opening animation the client asked for.

### 5.1 Layout (after the animation settles)
Two columns. **The form is on the right** at a fixed 500px — the RTL reading
origin, so the eye lands on the fields without crossing the page — and the brand
panel takes the remaining width on the left.

**Brand panel** (`brand-900`, white text):
- Islamic lattice motif as a repeating SVG `<pattern>` at ~5% opacity — a geometric tile, not imagery.
- Top: full logo lockup (white version) — the **same file** as everywhere else, never redrawn.
- Middle: eyebrow `حلقات جامع محمد العبدالكريم — الدمام، حي أُحد`, then the ayah in `t1`
  BrandDisplay with generous leading:
  > وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ — القمر ١٧
- Bottom: live counters — `٧ حلقات · ١٠٢ طالبًا · ٧ معلمين` — read from the database, not hard-coded.

**Form column** (`page`):
- `تسجيل الدخول` in `d1` BrandDisplay, subline in `ink-600`.
- Fields: login ID (`رقم الهوية`) and password. Remember-me. Primary button full width, `brand-800`.
- A hairline, then the student entry point.
- Footer: support line in `micro` `ink-500`.

### 5.2 The opening curtain  ✅ built

A full-bleed **curtain** in the page colour holds the mark dead centre, then the
whole curtain **lifts out of the top of the viewport**, uncovering the screen
that was rendered underneath it the entire time. The reveal is genuine: the page
is uncovered, not faded in.

> An earlier version had the mark travel and shrink into its corner. It read as
> noise rather than as an entrance and was replaced. Recorded here because the
> distinction is the whole point — one gesture, in one direction.

| t | What happens |
|---|---|
| 0 → 380ms | The complete lockup fades in at the centre of the curtain, `height: 104px`, from `opacity 0 / scale .97` |
| 380 → 2000ms | It holds. Nothing else on screen. This is the brand moment |
| 2000 → 2780ms | The curtain translates to `-100%` on `cubic-bezier(0.7, 0, 0.2, 1)` — slow to release, quick to clear |
| 2780ms | Focus lands on the national-ID field |

**Runs on every visit, reloads included** — the client asked for it explicitly.

> Worth revisiting at handover: the supervisor signs in daily and may reload
> often, and 2.8s each time becomes a tax. Shortening it for repeat loads is a
> single number in `lib/motion.ts`.

**Between screens there is no curtain.** A full-bleed reveal on every navigation
reads as an obstruction when it happens dozens of times an afternoon, so the
grand entrance belongs to arrival alone. Navigation instead shows a small fixed
indicator at the top centre — the mark inside a 68px disc with a `brand-700` arc
turning around it, held a minimum of 520ms so a fast route change cannot make it
blink. It never covers the work: the screen underneath stays visible and
readable throughout.

All timings live in **`lib/motion.ts`**; components read from it and never
hard-code a duration.

Implementation notes:
- Animate **`transform` and `opacity` only.** Verified in a real browser: during
  the hold the mark measures **0px off centre on both axes**, and the curtain
  translates cleanly to `-100%`.
- **The timeline waits for the mark to decode** before starting, capped at
  900ms. Without this, a cold load spends the whole hold on an empty ground.
- The mark is `<link rel="preload">`ed in the root layout.
- **`prefers-reduced-motion: reduce` → skip straight to the settled state.**
- The form is in the DOM and focusable from t=0. Motion never gates input.
- The wrapper must not carry `overflow-hidden`, or it clips the lifting curtain.

---

### 5.3 ثلاثة أبواب، إطارٌ واحد  ✅ built

«عندنا ٣ صفحات، أولاً كلها تكون بيانات التسجيل في الجهة اليمنى والقسم الذي فيه الآية
في الجهة اليسرى، والستارة تظهر لهم الثلاثة، وأزرار الانتقال من صفحة إلى صفحة تكون
مستطيلان بجانب بعض: دخول معلم — دخول طالب — أو دخول مشرف» (client, 18 Sep 2026).

Three doors into one building, and they had drifted. The supervisor's form sat on
the right and the two portal forms on the left; only his had the curtain. A man who
signs in as a supervisor in the morning and as a teacher in the afternoon should not
have to find the fields twice — so `components/LoginFrame.tsx` is the frame and the
three pages are three FORMS inside it. What differs between them is what actually
differs: the fields, the portal label, and the line at the foot of the brand panel.

- **The form is first in the DOM**, which in RTL puts it on the right, where the eye
  starts reading. The brand field is the only deep ground in the product (§1.3).
- **Below `lg` the panel steps aside** and the lockup moves above the form: a phone
  has room for one column, and the fields are what a boy came for.
- **`useCurtain` is the timeline**, shared — so «الستارة تظهر لهم الثلاثة» is one
  implementation rather than three that drift apart again.
- **`LoginDoors` names the OTHER two**, always two rectangles side by side. Three
  portals on one domain, and the wrong door answers «البيانات غير صحيحة» — which
  reads as a broken password rather than as a wrong door. The rectangles say it
  before it happens, and they are the same two rectangles on all three screens.
  Nothing is written above them: «كلمة لست هنا في صفحة التسجيل احذفها» (client,
  18 Sep 2026) — two doors labelled «دخول معلم» and «دخول طالب» say what they
  are, and a question over them only asks the reader to read twice.

## 6. Navigation map — mockups reconciled with the approved scope

The mockups' rail is wrong for this product. This is the correct one, derived from `SPEC.md` §6–§7.

### Rail (top group — daily work)
| Icon | Label | Route | SPEC ref |
|---|---|---|---|
| home | الرئيسية | `/admin` | إد-٢ |
| users | **الطلاب والحلقات** | `/admin/students` | إد-٣-أ **+** إد-٣-ب |
| doc | الخطط | `/admin/plans` | إد-٥-أ |
| check-square | الاختبارات | `/admin/exams` | إد-٥-ب · إد-٥-ج |
| coins | النقاط والمتجر | `/admin/points` · `/admin/points/codes` · `/admin/store` | إد-٤-أ · ب · ج |
| chart | المتابعة والتقارير | `/admin/follow-up` | إد-٥-د · هـ |

### Rail (foot group)
| gear | الإعدادات | `/admin/settings` |
| logout | تسجيل الخروج | — |

### Merged
- **الحلقات** has no rail entry of its own. The client asked for the halaqat to
  live inside the students screen, and the shape agrees: a halaqa is how the
  roster is grouped, so it belongs in the panel that groups by it. Seven
  destinations, not eight. See `SPEC.md` §6.2.

### Removed from the mockups
- **التحضير (attendance)** — ~~stays in Ratel~~. **Reversed, 17 Sep 2026.** The third
  requirements document makes it the heart of a portal of its own, so it is captured now — but on the
  TEACHER's surface (§12), never on the supervisor's. He still only reads it.
- **التسميع (recitation logging)** — ~~stays in Ratel~~. **Reversed with it**, and for the same
  reason. Ratel «يخرج من يد المعلم في هذه النسخة».
- **واجهة ولي الأمر** — not in phase 1.
- **حسابات المعلمين** — ~~phase 2~~. **Shipped**, as `الإعدادات → المعلمون`. It is not a rail entry:
  accounts are issued once and reset rarely, which is a settings act, not a daily one.

### Student portal — no rail
Five routes, a bottom tab bar on mobile, a slim top bar on desktop:
`الرئيسية` · `شحن كود` · `المتجر` · `مستواي وخطتي` · `الترتيب`. Reading density, display headings,
big touch targets. The fourth is labelled `مستواي` in the bar alone — five labels have to fit
across a 360px phone.

`الترتيب` is the one screen on this surface that names anyone but the boy reading it, and it is
bounded deliberately: it shows what لوحة الشرف (§8, approved PDF §8) already posts on the halaqa
wall — a place, a `shortName` and a figure — and nothing else. No identifiers, no levels, no
halaqa membership. The board is windowed **on the server** (`lib/rank.ts` → `boardWindow`), so a
boy ranked ninetieth is sent the head of the board and his own neighbourhood rather than all
hundred and seventeen rows. Ties share a place and consume the ones beneath them: 1, 2, 2, 4.

---

## 7. Component inventory

Build these once, in `components/`. Names are stable; screens compose them.

**Primitives** — `Btn` (default · primary · ghost · danger; sm/md/lg/xl) · `Field` · `Input` ·
`SearchInput` · `Segmented` · `Toggle` · `Checkbox` · `Select` · `Pill` · `Avatar` · `Num`

**Structure** — `Rail` · `RailBtn` · `PanelShell` · `PanelGroup` · `PanelItem` · `PanelCheck` ·
`PanelRadio` · `ChipRow` · `TopBar` · `Sheet` · `SheetHead` · `Row` · `Modal` · `Toast` · `Banner`

**Data** — `KPI` · `Bars` · `LineChart` · `Ring` · `HeatStrip` · `StatusShape` · `StatusChip` ·
`TrendMark`

**States — mandatory for every list and every screen** — `Skeleton` · `TableSkeleton` ·
`CardsSkeleton` · `Empty` (title + body + action) · error boundary with a retry.
A screen without all four states is not done.

**Charts read right-to-left**: oldest point on the right, newest on the left with the emphasised
endpoint — mirroring the text direction.

### 7.1 `Modal` is a SHEET, and it can be pushed away

«النوافذ تكون سلسة تطلع من تحت وتنزل من فوق، وتكون قابلة للسحب» (client, 18 Sep 2026). It used to
appear with `rise` and then simply cease to exist — no exit at all, which on a phone reads as the
screen blinking rather than as something being put down.

It now has **five phases, and only arrival is a keyframe.** Arrival starts from a known place;
everything after it starts from wherever the thumb left the sheet, and no keyframe can know that. So
the drag writes `--sheet-y` with the animation switched off, and both settling back and leaving are
TRANSITIONS of that same property — a sheet flicked halfway down carries on from halfway rather than
snapping back to be animated away. `sheet-rest` is the quiet state between them, and it exists so
that returning from a drag never replays the arrival under the reader's thumb.

**The grip is the header**, not a hairline pill on its own: a thumb reaches for the title bar, and
the body below it has its own scroll that a drag must not steal. The pill is drawn on the header on
phones as the affordance, and the gesture is a phone's way out — a mouse has the ✕ and the backdrop.
**The backdrop lightens as the sheet is pulled**, so the gesture shows its own outcome before the
thumb is lifted. Past 120px, or fast enough, letting go dismisses; short of that it slides back.

Everything that closes it — the ✕, the backdrop, Escape, the drag — goes through one `close()`, so
it is never yanked out of the page without falling.

---

## 8. Print surfaces

Print is a first-class output here, not an afterthought — the supervisor prints plans daily.

- Dedicated `/print/*` routes. No rail, no panel, no TopBar.
- A4 at 794 × 1123 px so the on-screen preview matches the sheet.
- `BrandDisplay` headings, Arabic-Indic numerals, both logos in the header
  (mosque right, association left — the lockup from §5 of the requirements PDF).
- Status **shapes** carry meaning; the sheet must survive a greyscale printer.
- `@page { size: A4; margin: 18mm 16mm; }`, `thead { display: table-header-group; }`,
  `tr { page-break-inside: avoid; }` — the same technique that produced the requirements PDF.

---

### 8.1 ورقة الخطة — ثلاث خلايا، لا اثنتا عشرة

«قالب الخطة الآن مب واضح وفيه أشياء متداخلة ومختفية. أبغى عمود من سورة والآية إلى
سورة والآية في كل مقرّر تكون خلية وحدة، يعني ثلاث خلايا، جمب كل مقرّر خلية الدرجة،
وفي الأخير خلية الملاحظة وتكون طويلة شوي» (client, 18 Sep 2026).

A reversal, and a correct one. Each مقرّر used to take FOUR columns — من سورة،
آية، إلى سورة، آية — on the reasoning that a teacher reads down a column of
surahs and a column of ayat. Seventeen columns across 703px is what that cost,
and at that width every name was ellipsised, which is the «متداخلة ومختفية» he
describes. **A range is ONE fact**: «الحديد ١ — الحديد ١١» split across four
boxes is read by reassembling it, and a sheet reassembled at every row is a sheet
nobody reads. Eight columns give each range the width to print whole, and the
surah is said ONCE when both ends sit inside it.

The two badge rows are three cells each — «خلية الوسام تكون على ٣ أعمدة: الأول
اسم الوسام، والثاني التاريخ وتُكتب كلمة التاريخ في نفس الخلية، والثالثة الملاحظة».
The word stays inside the box because the box is filled in by hand, months later,
by whoever is holding the sheet.

And مرجع التجويد shrank — «لكي لا ينتقل إلى صفحة أخرى». It is a reference, not a
lesson: read once by whoever is unsure, and every millimetre it takes is one the
twenty-four rows above it do not have. The sheet measures 794×1123 with the last
line 34px clear of the margin.

## 9. RTL and accessibility — enforced, not aspirational

1. **Logical properties only**: `ms-`/`me-`/`ps-`/`pe-`/`start`/`end`. A literal `left`/`right` in a
   component is a bug, except where a physical edge is genuinely meant (the rail's edge indicator).
2. Every interactive element has a visible focus ring: 2px `brand-700` at 2px offset.
3. Test every screen at **375px** as well as 1440.
4. Contrast floors are stated per token in §1.2 — do not introduce a colour without measuring it.
5. Icon-only controls carry `aria-label`; the rail additionally carries a visible tooltip.
6. `prefers-reduced-motion` is honoured everywhere, not just on sign-in.

---

## 10. What this locks

- ✅ Palette, sourced from the client's own logos
- ✅ Two families, with serif restricted to reading surfaces
- ✅ Hybrid density, with the boundary drawn explicitly
- ✅ Rail + contextual panel shell, with the panel's per-section behaviour defined
- ✅ Sign-in structure and its opening animation, with timings
- ✅ The corrected navigation map, reconciled against the approved scope
- ✅ Component inventory and mandatory states
- ✅ The student portal's redesigned surface (§11)
- ✅ The teacher portal, which shares that surface rather than the supervisor's (§12)

**Open:** exact icon set (Lucide is the working assumption — it is what the mockups use and it ships
tree-shaken), and the lattice tile geometry, which will be lifted from Mockup A's `<pattern>`.


---

## 11. The student portal — the phone surface

The desk surfaces and this one share a palette and nothing else. The supervisor is at 1440px with
a mouse, reading tables; the boy is six to eighteen, standing in a mosque, holding a phone.

**Provenance.** Redesigned from a Claude Design prototype (`Student Portal.dc.html`, 11 Sep 2026)
drawn against the tokens in §1–§3. It introduced **no colour of its own** — every value in it
resolves to a token already in `tailwind.config.js`. What changed is arrangement, not palette.

### 11.1 الرئيسية — the hero at the top of one page
On a phone the card IS the top of the screen.

> **Superseded 18 Sep 2026.** It used to be `sticky top-0`, with the sheet of detail below it —
> full-bleed, 28px top radius, its own opaque ground — climbing over it as he scrolled while the
> card retreated `0.32×` the distance travelled and faded out over 300px. Apple Wallet's move, and
> the reason the card could be this big without costing a screenful.
>
> (And on 18 Sep 2026 the card's bottom corners were curved even full-bleed — «هيرو الطالب خلّه
> كيرف» — matching the teacher's. It reaches both edges and the top of the screen because it IS the
> top of the screen; its bottom is where the card ends and the page begins, and a card ends with a
> corner.)
>
> The client asked for the two to be **one page** with the card's own detail staying put, and took
> the watermark with it. Both portals' heroes are now a card at the top of an ordinary page. The
> reasoning above was sound and the decision was his, so it is recorded rather than deleted: the
> cost of the change is that a big card now costs a screenful, and the gain is that nothing on it
> moves while he reads it.

That only works if the card owns the top, so **الرئيسية hides the phone's top bar** and the hero
carries the mark, the name and خروج itself — two sticky layers saying the same three things is one
too many. `SignOutButton` exists so the bar and the hero ask the same question. Above `md` the
portal keeps its own sticky bar, the card goes back to being a card, and the parallax does not run.

### 11.2 The tab bar — four tabs and a disc
`شحن كود` is the most frequent thing a boy does here and it was one fifth of a bar, the same size
as `الترتيب`. It is now the raised 58px disc in the middle — `1fr 1fr 76px 1fr 1fr`, ringed in
`page` so it reads as sitting above the bar — in reach of the thumb from every screen. The tab it
vacated went to `الترتيب`. On a desktop there is no thumb and no bar, so it is a link like the
others and sits second, as it always did (`DESKTOP_TABS`).

### 11.3 الرئيسية — one ring instead of five boxes
Four jewel tiles (المستوى · الأجزاء · ما أنجزته · اجتزتها) and a progress rail were five separate
boxes stating five facts about one thing. They are now `Journey`: a single 96px ring with the level
in the middle of it, the juz phrase beside it, and the percentage and bar underneath.

The card lost its «بطاقة الطالب» label — a card need not announce that it is one — and lost the two
large buttons under it, since شحن كود and المتجر are both already destinations in the tab bar. What
took their place is the rank chip: the boy's standing in his own halaqa, which is the other thing
he opens this screen to see.

آخر اختباراتي became a horizontal rail of cards rather than a list of rows, each score drawn as the
proportion it is. Pass and fail still carry a WORD as well as a colour.

**The ring measures THIS LEVEL** (18 Sep 2026) — «حلقة المستوى خلّها حلقة تحسب كم أنجز من المستوى
هذا». It drew his share of the whole TRACK, which for a boy on level 60 of 60 is two per cent on the
day he starts and three a fortnight later: a ring that never visibly moves is a ring nobody looks at
twice. What he is actually working through is the twenty-four مقرّرات in front of him, and that arc
fills. `at` is what he must recite TODAY, so what he has FINISHED is the one before it. The track's
own share keeps a quiet line underneath — «أين أنا من المسار كله» is worth one sentence, just not the
headline — and with no pointer set the ring falls back to the track exactly as before.

### 7.1a `INPUT` has a SIZE, and that is a trap

`cx(INPUT, 'w-20')` puts two width utilities of equal specificity on one element,
and which wins is decided by the order Tailwind EMITTED them in — not by the order they were
written. It is the same trap `BTN.danger` is documented for, and it had been sprung: `INPUT` carries
`w-full`, so every narrow numeric box in the settings tables rendered at the width of a paragraph.
The مقرّر field on مقرّرات الطلاب was five hundred pixels wide for one number.

`INPUT_BARE` is the look with no size at all; `INPUT` is that plus `h-11 w-full`. Anything that wants
its own width composes the bare one and states both. The rule for the next person: **never append a
size to a class constant that already has one.**

### 7.2 `DateRangeField` — one calendar, two taps

Two date fields side by side can be set to an impossible order, and then something has to argue with
the reader about it. The client offered both fixes and preferred the second: «فلا يمكن تحديد الفترة
الثانية قبل الأولى وتظهر الأيام باهتة، أو ممكن تخلّي تحديد الفترة في تقويم واحد — الضغطة الأولى تحدد
من والضغطة الثانية تحدد إلى، وأظن الفكرة هذي أفضل» (18 Sep 2026).

So the period is ONE calendar. The first tap sets «من», the second sets «إلى» and closes it, and the
grid says which tap it is waiting for, because a control that behaves differently on alternate taps
must say which tap this one is. Between them the range is tinted as the pointer moves, so the reader
sees the period before he commits to it.

**Days before the start stay live.** Greying them out would enforce the order too, but it would trap
a reader who mis-tapped his start into closing the calendar to try again. Tapping earlier simply
moves the start there — the order still cannot be broken, and nothing has to be undone.

**Only the FUTURE is faded** — «خلّي الأيام المستقبلية باهتة لكي يتضح للشخص أنه ما يمكن الضغط عليها».
It was a grey that could be taken for an ordinary day at arm's length; it is 30% and flat now, takes
no hover, and no tap can ever make it choosable. Both fields share one `MonthGrid`, so the day a
calendar gains anything, both gain it.

### 7.2a The date field wears the FORM's chrome on the supervisor's screens

«خانة التاريخ في تسجيل اختبار ما ضبطتها على هوية الموقع، وكذلك في التقارير»
(client, 18 Sep 2026).

It was the site's own calendar already — that was §7.2's whole point — but it was
wearing بوابة المعلم's chrome on بوابة الإدارة: 42px tall and `rounded-xl` beside
a `Combobox` at 44px and `rounded-md`, with its icon on the other side. Two
controls in one row that open the same way must open from the same side and
stand the same height, or the newer one reads as something pasted in.

So `chrome` is a prop, not a redesign: `portal` keeps the rounded card surface
the phone surfaces were approved with, and `field` is `INPUT`'s own height,
radius, padding and type, with the calendar where `Combobox` keeps its chevron.
The four supervisor surfaces pass `field`; the three portal ones do not.

### 7.3 `ScrollProgress` — the indicator moved to the top

§12.5b put the scrollbar on the document so the portals would have one. The client asked for
something else in its place: «مؤشّر السكرول خلّه باللون الأبيض الخفيف في أعلى الشاشة من يمينها إلى
يسارها، في كلٍّ من عند الطالب والمعلم» (18 Sep 2026).

A scrollbar on the right edge is the desktop's answer to «كم بقي»: hidden on a phone, and on a laptop
sitting in a rail nobody looks at. A hairline across the TOP says the same thing where the eye
already is, and it grows from the right because that is where Arabic starts — in RTL a block element
with a width does that on its own.

It is white on a track of the brand at a quarter strength, and the track is not decoration: the bar
rides over the teal hero AND over the near-white page below it, and a white line with no track under
it would vanish against the page at exactly the moment it became worth reading.

### 7.4 `TabPill` — the MARK moves, not the page

This went one step too far and came back. The whole PAGE slid between tabs for an afternoon, and the
client stopped it: «الانتقال السلس بين الصفحات ما أبيه على الصفحة نفسها، رجّع الوضع الأول. أبي البار
نفسه، ولون تحديد الأيقونة في البار هو اللي ينتقل يمينًا ويسارًا» (18 Sep 2026).

He is right, and the difference is worth stating. Sliding the page animates the CONTENT — the thing
being read moves under the eye, and costs a beat before anything can be looked at. Sliding the
highlight animates the CONTROL: the bar says «you were there, now you are here» while the screen
underneath is simply already there. Same information, none of the wait.

The mark is **measured**, not computed from an index, because the two bars are not the same grid: the
teacher's is five equal columns and the student's has a 76px well in the middle for the raised disc.
Measuring asks the browser where the tab actually is, so a bar that changes shape cannot put the mark
in the wrong place. Two details are load-bearing:

> **It is pinned to the physical left edge** and pushed by a physical offset. An absolutely-positioned
> box with no `left` takes its STATIC position, which in an RTL row is the right edge — and the
> translate then carries it off the screen.
>
> **It is measured synchronously in the effect**, not in a `requestAnimationFrame`. The effect runs
> after React has committed, so the tab carrying `aria-current` is already the new one. The frame
> after is a backstop for a font that lands late — and only a backstop, because a page that is not
> being painted never runs it.

`data-tab` marks the flat tabs only: the student's raised disc is `current` when it is open, and the
mark must not fly into a circle that sits above the bar rather than in it.

### 7.5 مؤشّر السكرول — ONE indicator, and it is not on the side

This went three ways and the third is the answer. It began hidden on the portals; §12.5a gave it the
supervisor's rail, because a scrollbar you cannot see is a rail nobody knows can be scrolled; §7.3
put a hairline across the TOP instead, which says the same thing where the eye already is; and then
the side rail became a second answer to a question already answered — «احذف السكرول الجانبي» (client,
18 Sep 2026).

So in `.portal` there is no side rail at all: not on the page, not on the horizontal card rows, where
a grey line under a row of cards reads as a border rather than as a control. The supervisor's surface
keeps `.thin-scroll` — he is at 1440px with a mouse reading tables, and has no bar across his top.
`html:has(.portal)` scopes it, so the two surfaces differ by what they ARE rather than by a flag.

### 11.3a مقرّر اليوم — restored once it stopped being a guess

This screen used to carry a «today» block, and it was removed for a reason that was right at the
time: nothing in the system recorded which مقرّر a boy had actually reached, so any day named here
would have been inferred from the calendar — and a guess on this screen sends a child to the wrong
passage on the system's own authority.

**The teacher's portal removed the reason** (18 Sep 2026). `student_progress` holds the مقرّر he must
recite TODAY, moved by his own teacher's save, and `day_entries` hold every مقرّر that was actually
recited and when. So the block is his teacher's record read back to him, and the client asked for it
back: «فيه ميزة كانت عند الطالب … تحديد المقرّر اللي وصل إليه الطالب، وتعليم المقرّرات السابقة بعلامة
صح في حال سجّلها المعلم … أبيك ترجعها الآن، ورجّع بلوك مقرّر اليوم في الصفحة الرئيسية».

It sits directly under the card, above everything but a coming exam, and shows the three passages in
the same tones the plan grid uses — the same passage looks the same on both screens. On a badge
مقرّر it says one thing instead of three, because «لا يمضي في الحفظ قبل اختباره».

**It shows NOTHING when nobody has set his pointer** — not an empty box and not a «لم يُحدَّد». The
old reasoning still holds wherever the record is silent.

### 11.3b تنبيهاتي — الجرس، والبلوك تحت الاختبارات

«أضف زرّ الجرس للطالب، وبلوك التنبيهات كذلك أسفل بلوك الاختبارات، وتعرض للطالب التنبيهات التي تُسجَّل
له من قِبل المعلم أثناء تسجيل التسميع، وترسل له تنبيهات الاختبارات وتنبيهات الهدايا والتي تُرسل من
قِبل المشرف» (client, 18 Sep 2026).

The teacher's bell shipped first; this is the same object on the other side of the same afternoon,
and that is the point — **a note his teacher wrote while he recited reaches him looking like what it
is.** Five kinds, and every one of them is a ROW: a note beside a مقرّر or on the day, a result, a
booking, a gift's status, a message from the administration. «والتنبيه الذي لا يستطيع النظام حسابه لا
يُعرض أصلًا» holds harder for a child than for his teacher.

The block sits under آخر اختباراتي because his exams are what he opens this screen for, and what his
teacher said about today comes straight after them. The bell rides on the card beside خروج, carrying
the UNREAD count and nothing at all when nothing is unread.

The kinds are written OUT for him: «ملاحظة معلمك على المراجعة الكبرى», never «على م.ك». The
abbreviation is for a printed column, and this is a sentence read by a child.

`student_alert_reads` mirrors the teacher's table for the same reason it exists there — most of these
have no id of their own to mark.

### 11.4 مستواي وخطتي — the sheet as a grid
Twenty-four days in a three-column grid, the whole level visible at once, any day opened with one
tap — replacing a list that had to be scrolled to find anything. Exam days carry the warn tone; the
selected day expands above the grid into three cards, one per kind, in the tones the prototype used
(brand / info / ok — all tokens). A ladder of every level in the track sits on the level card and
scrolls the current one into view on arrival.

**And the grid opens on HIS day.** It used to open on day one whatever a boy had done, for the reason
in §11.3a. It now opens on `student_progress.assignmentNo`, rings that square while he is looking at
another, and **ticks every مقرّر his teacher recorded** — `day_entries` matched on level and track as
well as on the number, so a boy repeating a level does not inherit last term's ticks. A day with no
درس recited gets no tick: the درس is what moves him, which is what `advances` says on the teacher's
side too. The legend grew two entries to say so.

### 11.5 المتجر — the named gap
A gift out of reach keeps its place on the shelf and gains a bar: «بقي ٥٠ نقطة» is now something he
can watch filling. What he can afford sorts to the front, dearest first, so the top of the grid is
the best thing within reach today. A filter chip pair narrows to «أقدر أشتريها» with a live count.

### 11.6 What was deliberately NOT adopted
The prototype is a mockup and two of its moves do not survive contact with this app:

- **«اليوم في خطتي».** The prototype preselects day 6. `/api/student/plan` deliberately points at no
  day — nothing records which one a boy reached, and a guess sends a child to the wrong passage on
  the system's authority. The grid opens on day 1 and says «اضغط أي يوم». When the teacher's screen
  records attendance this can preselect and be right.
- **Bottom sheets as a new component.** Not needed: `Modal` already rises from the bottom on a
  phone and centres on a desktop.
- **The redeem screen.** Already built with a real camera path (native `BarcodeDetector` with a
  lazy fallback) and a `?code=` deep link from the printed QR. The prototype's version adds nothing
  and its scan was faked on a timer.

### 11.7 Motion
Count-ups on the balance, rings filling from zero, cards rising. `transform`/`opacity` only — and
every one checks `prefers-reduced-motion` in **JS** as well, because a count-up is a state change
and the CSS rule in §5.2 cannot reach it.


---

## 12. بوابة المعلم — the second phone surface

**Provenance.** Built from «متطلبات بوابة المعلم — النسخة الثالثة» (15 Sep 2026), held against this
codebase line by line before a line was written, plus the client's calendar answer of 17 Sep 2026.
It introduces **no colour, no type step and no component of its own** — every value resolves to a
token already in §1–§3, and the card, the press, the thumb-scrolled rails and the sticky-hero
parallax are the student portal's, reused.

### 12.1 Why it shares the student's shell and not the supervisor's

The supervisor is at 1440px with a mouse, reading tables of a hundred and seventeen. The teacher is
standing between twenty-five boys holding a phone in one hand — «مصمَّمة للجوال قبل الكمبيوتر …
والشاشة تعمل بإبهام واحد» (§7, verbatim). That is the boy's posture, not the supervisor's, so it is
the boy's shell: no rail, five destinations, a bottom bar on a phone and a slim top bar above `md`.

The CSS that was `.student-body` is now `.portal`, carried by both. Nothing in it was ever about
being a student.

### 12.2 The bar — five equal tabs, and no disc

`الرئيسية` · `التسجيل` · `طلابي` · `النقاط` · `التقارير`

The student's bar raises `شحن كود` out of the middle because one action dwarfs the rest. **The
client chose five equal tabs here** (17 Sep 2026), and the shape holds up: `التسجيل` sits second,
and الرئيسية is itself a card whose one large button opens it — so the afternoon's work is one tap
from anywhere without a control that looks unlike its neighbours.

**الاختبارات and الخطط have no tab**, deliberately. Everything the teacher may do with either is
READ — «إشعار الاستحقاق، وموعد الحجز، والنتيجة مفصَّلة» and «عرضها وطباعتها وإرسالها — لا
إصدارها» — so they live where they are read: تنبيهات الرئيسية, ملف الطالب, and كشف المستحقين under
التقارير. The same rule that kept الحلقات off the supervisor's rail (§6).

### 12.3 بطاقة اليوم — the hero, on both screens

§7 asks for the date in both calendars, the halaqa and its hour, the state of the day, and **one
large button**. That is one object, and it is بطاقة الطالب's object: `sticky top-0`, the sheet of
detail climbing over it while the card retreats `0.32×` the scroll and fades over 300px. Which is
why the screens that carry it hide the phone's top bar, and why the card carries خروج itself.

**One component, two screens** (`DayHero`). التسجيل had a bar; on 18 Sep 2026 the client asked for
«الهيرو يكون نفس الرئيسية», and it is right: a teacher moving between the two should not have to
re-find where he is and when. On التسجيل the card also holds the three recording modes and the
past-day picker, so «أين أنا، ومتى، وفي أيّ وضع» is one object rather than three.

The button's WORD changes with the state and its place never does — `ابدأ` · `أكمل` · `راجع`. A
teacher aims at the same spot every afternoon. And the roster total sits in the card because it is
the denominator every figure under it is a share of.

**No entrance, no parallax, no watermark, and ONE PAGE.** §11.1's Apple-Wallet move — the card
sticking while a sheet of detail climbed over it, retreating `0.32×` the scroll and fading — is gone
from both portals. The client asked for the hero and what follows it to be «صفحة وحدة» with the
card's own detail staying put: «فالتفاصيل اللي موجودة في الهيرو ما تختفي ولا تتحرك مع السكرول»
(18 Sep 2026). So it looks exactly as it did and simply scrolls away with everything else. The
ghosted mark behind it went too: the mark on the roof of the card is the same mark, and a second one
in the corner was decoration rather than identification.

**And it never shows a bare zero.** Four counters at zero read as an empty halaqa rather than one
that has not begun, so before the first save the row is replaced by a sentence: «لم يبدأ التسجيل —
١٢ طالبًا في حلقتك».

The Hijri date leads because it is the calendar the mosque speaks in. `lib/dates.ts` refuses the
runtime's locale calendar on purpose (`ar-SA` resolves differently on different engines), so
`hijri()` names **Umm al-Qura** explicitly and returns Latin digits for `<Num>` to isolate.

### 12.4 صفحة التسجيل — the heart, and the only screen that writes

Twenty-five cards on ONE page, card under card — «لا بطاقة واحدة ينتقل بينها بـالتالي، فالمعلم
يسمّع لطالب ثم لآخر ثم يعود إلى الأول». Each card saves itself: «والحفظ للبطاقة لا لليوم كله»,
which is also what makes two devices collide on one named boy rather than on the halaqa.

On the card, after the client's pass over it on 18 Sep 2026:

- **التحضير is ONE ROW** — `حاضر · متأخر · غائب` — with `الثوب` on the same row behind a hairline,
  because it is a different question about the same boy. Each state carries a **shape** as well as a
  tone (§1.4): these are read on a bright phone in a courtyard.
- **There are three states, not four.** مع-٣-ب names «غائب بعذر» among them; the client removed it —
  «احذفها من الموقع كامل» — and it is gone from the database enum too, not hidden on the screen. It
  took a rule with it: §١٥'s «والغياب بعذر لا يُحتسب فيه، ولا يقطع التتابع» has nothing left to
  describe, so repeat absence now counts every absence there is.
- **Pressing the chosen state again clears it.** A teacher who tapped the wrong name needs a way
  back that is not a page reload.
- **التسميع does not appear until he is marked present.** An untouched card shows one decision, not
  four; and a boy marked away has no lines at all — «تُغلق خانات تسميعه».
- **The lines say what they are** — «المراجعة الكبرى» — rather than م.ك. The abbreviation is for
  printed columns, where there is room for three characters; on a card there is a whole row.
- **The whole line toggles**, not the tick. A thumb aimed at a 36px box between twenty-five cards
  misses; a thumb aimed at the row does not. The errors stepper and the note button inside it stop
  the click from reaching the row.
- **الأخطاء is labelled**, and it is a stepper — a teacher counting while a boy recites taps. The
  field stays for the day it was eleven.
- **Each line carries its own note**, behind a message icon beside the stepper, opening a modal.
  `day_entries.note` still holds §٩'s note on the AFTERNOON; «تعثّر في الآيات الأخيرة» is a note on a
  LINE, and a teacher writes both.

No score, no grade, no points. «هي صفحة تسجيل لا صفحة تقييم»; the running total lives in the hero
and the points are computed on the server.

`الكل حاضر` fills BLANKS only — «ثم يعلّم المعلم الاستثناءات فقط». `احفظ الكل` beside it sends every
unsaved card in ONE request (each still its own transaction), because twenty-five round trips on
mosque wifi is the difference between a second and a minute. A search box and a `الحاضرون فقط` filter
sit under them, for the halaqa of twenty-five where the boy you want is the nineteenth.

**وضع «يوم سابق» keeps its own date.** Switching to «اليوم» shows today and nothing else: a teacher
who looked at last Tuesday and then turned back to record this afternoon must not find Tuesday's
card under his thumb.

**The four states a card can be in besides the ordinary one** each say why, and none of them carries
a control: مسار التلقين · لم تُصدر خطته · يستحق الاختبار · **لم يُسجَّل له مقرّر**. That last one is
not in the requirements document and had to be — it adds the مقرّر pointer without saying where the
students already halfway through their levels get their first value. The teacher may NOT set it
(client, 18 Sep 2026): the card tells him to see his supervisor, and the supervisor sets it from
`الإعدادات ← المعلمون ← مقرّرات الطلاب`. Which makes that screen load-bearing rather than a
convenience: without it «راجع المشرف» is a door nobody can open.

### 12.4a A SAVED DAY IS A RECORD, NOT A PROPOSAL

The pointer says what a boy must recite TODAY, and saving a day MOVES it. The card read that pointer
whatever day it was showing — so the moment a teacher saved Tuesday, Tuesday's own card began showing
WEDNESDAY's passages: «إذا سجّلت أن الطالب سمّع الدرس وسويت حفظ فيتغير عندي مقرّر التسميع في هذا اليوم،
والمفروض أنه يبقى كما هو ويتغير اليوم الذي بعده فقط» (client, 18 Sep 2026).

`day_entries` already carried the مقرّر, the level and the track the day was recorded at, and the
column's own comment said why: «kept here as well as on StudentProgress because the pointer moves on
and this row must still say what was recited». It was written and never read. It is read now, and the
pointer is consulted only for a day with nothing saved on it.

Two things fall out of that, and both are right:

> **Clearing a day puts its مقرّر back on the card**, because the row that anchored it is gone and the
> pointer — which the clear also rewinds — is what answers again.
>
> **A day already written keeps its lines even after the pointer stops at a badge.** The boy who
> reached ١٢ by reciting on Thursday must still see Thursday's recitation when he opens Thursday,
> rather than «يستحق الاختبار» where his three lines were.

### 12.4b مسار التلقين — أين وقف

A talqeen boy is outside the curriculum by design: «لا مستوى له ولا منهج، فلا نقاط» (§١٣-١). What
followed from that in practice was a card offering him attendance and a thobe and nothing else, and
NOTHING in the system remembering where his teacher had left him — so every afternoon began by
asking him. The client closed it: «طلاب التلقين ذكرنا أنه يسجّل لهم المعلم آخر سورة قرأوها وآخر آية
حفظوها، وفي اليوم التالي يعرض من أين يبدأ» (18 Sep 2026).

His card now carries two fields and one sentence, and **the sentence is the point**: «يبدأ من» is
what the teacher reads before either of them opens a mushaf. It rolls over — a boy who finished
الضحى at its eleventh ayah starts at الشرح — which is the whole reason `lib/surahs.ts` carries the
ayah counts.

Three things are settled the way the rest of this surface settles them:

> **The surah is MATCHED against the 114, not stored as typed.** A misspelling would otherwise become
> a position nobody can search for. And the ayah is clamped to that surah's own count, because «آخر
> آية حفظها» in الناس cannot be the ninth.
>
> **It is written in two places**, like `assignmentNo`: on the DAY, which must keep saying what was
> read that afternoon, and on the pointer, which is what his card opens on tomorrow.
>
> **Nothing is invented when nothing is recorded.** The card says «لم يُسجَّل له موضع بعد» rather than
> opening at الفاتحة — a starting point nobody chose is a guess, and this surface does not make those.

The fields sit behind the attendance, like التسميع does: there is nothing to write down about a boy
who was not there.

**AND THE SURAH IS CHOSEN, NOT SPELLED** — «قائمة السور أبيها تكون قائمة بتصميم الموقع، وإذا المعلم
كتب سورة ليست من ضمن القائمة يظهر تنبيه» (client, 18 Sep 2026). The native `<datalist>` that was here
rendered in the operating system's own style, could not be walked from the keyboard, and on a phone
showed nothing at all; it is now `Combobox`, the same list the rest of the product uses.

It stays TYPEABLE, because a teacher who knows the name should not have to scroll for it — and that
is exactly why the warning exists. The server matches what was typed against the 114 before it
becomes a position, so a misspelling is DROPPED rather than stored; a field that quietly drops what
was typed into it is worse than one that refuses it. The card now says so, in the amber tone and
while he can still fix it: «ليست من السور الـ١١٤ — اخترها من القائمة، وإلا لن يُحفظ الموضع». Nothing
is blocked: he can still mark the boy present and save, which is the part of the day that matters.

### 12.4c «يحتاج مراجعة قبل الاختبار» — رأي المعلّم

«عند المعلم في صفحة الاختبارات أبي يظهر زر أن الطالب مب جاهز للاختبار ويحتاج
مراجعة، ويظهر عند المشرف والطالب ذلك» (client, 18 Sep 2026).

The pointer already knew when a boy had REACHED his exam مقرّر — `awaitingExam`
says so, and the supervisor's lists are built from it. Whether he is READY to sit
it is a different question, and the only person who can answer it hears him five
afternoons a week. That answer used to travel by telephone, when it travelled.

It is an OPINION, and it is built as one:

> **It gates nothing.** The booking screen still books and the recording screen
> still records; both simply say what his teacher thinks first. «المعلم لا يمكن
> أن يحدد مقرر الطالب» cuts both ways — a teacher who could block a sitting would
> be deciding the curriculum.
>
> **It is signed and dated**, and carries his words where there are any. A
> judgement nobody signs is one nobody lifts, and «يحتاج مراجعة» with no reason
> tells the boy nothing he can act on.
>
> **It lives on the POINTER** (`student_progress`), which is a teacher-portal
> table. It reaches the supervisor by riding down with `GET /api/state` and is
> absent from the PUT whitelist — so no browser sync can overwrite a teacher's
> judgement with a stale copy of it.

The boy is told too, in amber rather than red: this is «راجِع», not «رسبت».

### 12.5 ملف الطالب — للعرض لا للتعديل

Not one input on it. The banner says where editing lives and **links** there: telling a teacher a
thing exists elsewhere and making him find it are different.

Two absences are the point. No behavioural or medical note — the column does not exist in the
database either — and no guardian phone: the send button opens WhatsApp at it without ever
displaying it (§17, المسألة ١٥).

And رتل's `attendedDays` is shown **labelled and apart**. It is a count of days with no dates behind
it; the grid beside it has a row per day. Adding the two would be arithmetic on two different
things.

### 12.5a التقويم، والترتيب، والسكرول — the small controls

**The date field is drawn here, not by the operating system.** `<input type="date">` hands the
calendar to Windows: system greys, a Latin-first grid, an English day header on an Arabic screen,
and no way to say «الخميس ٦ ربيع الآخر». `DateField` keeps the native contract (`YYYY-MM-DD`, `min`,
`max`) and wears the halaqa's palette, Arabic weekday initials, and **the Hijri date of whatever is
chosen** — the one thing the native control can never show. It carries optional ‹ › day steppers,
and `max` is enforced on the grid, on the month arrow and on the steppers alike, because «ولا يمكن
تحديد ولا الانتقال ليوم مستقبلي» is a rule and not a hint. Used by التسجيل, فترة لطالب and التقارير.

**The scrollbar is the supervisor's.** The portals' rails used to hide it entirely — right on a
phone, and on a laptop it left a horizontal rail with no sign it could be scrolled at all. `.portal`
now wears `.thin-scroll`, so one indicator runs across all three surfaces.

**A sort chip is a toggle.** On طلابي, tapping the active chip reverses the order rather than doing
nothing. Each column opens in the direction that is useful — the name from alif, the level from the
most advanced, the longest silence first — and a second tap turns it over.

**Every history on ملف الطالب is capped at five**, and the ledger at ten. A file that scrolls for a
term is a file nobody reads to the bottom; what a teacher opens it for is the last week, and the
whole record is one tap away in the printed report — which is also where the rest of the exams went.

### 12.6 The printed sheets

Seven, all under `/teacher/print/*` rather than beside the supervisor's `/print/*` — the middleware
guards by audience, and his sheets carry a hundred and seventeen boys while these carry twenty-five.

**كشف حلقتي** carries two columns the requirements document did not name and the teacher asked
for: «مضى عليه» — days since his sheet was handed to him, bolded past §4.9's limit — and «آخر
اختبار» with its date and a pass mark. They are the two questions the sheet is folded into a pocket
to answer: who is stuck, and who is overdue for an examiner.

One of them breaks §8's portrait rule and says so: **الورقة الأسبوعية is landscape.** Five halaqa
days, each with حضور، ثوب and three lines, is twenty-nine columns; the paper the halaqa fills in by
hand is landscape for the same reason. «ورقة واحدة» is a promise about the number of pages.

### 12.6a الرئيسية — the student's home, one rank up

Laid out on the client's instruction that it «تكون مقاربة لعرض البيانات عند الطالب». His ring is his
own progress through a level; this one is the halaqa's progress through an afternoon — of those who
CAME, how many have had their مقرّر recorded, with a two-share bar for حضور against غياب underneath
and whatever is still undecided left empty rather than counted as either.

Then the student portal's own two rails, with names on them: `آخر اختبارات طلابي` as a horizontal
scroll of score rings, and `آخر حركات النقاط` as his `Ledger`.

`تنبيهات حلقتي` shows **five** — the newest five, see §12.5d — with «عرض المزيد» opening the rest in
a modal, and an **unread dot** on each — a `brand-700` disc on the alert's icon. Read state is server-side and keyed by a string the
alert derives from itself (`EXAM_DUE:<studentId>:<badge>`, `RESULT:<examId>`), because five of the
six alert kinds are COMPUTED from rows and have no id to hang a marker on. A teacher who read it on
his phone has read it.

### 12.5a1 وضع «فترة لطالب» — one boy, so his name is said once

The picker is CARDS with the level and the مقرّر on them — «حطّ الطالب في بطاقات ومعهم المستوى
والمقرّر فقط» (client, 18 Sep 2026) — because a row of bare names makes a teacher open one to find
out whether it is the boy he meant. The search sits above them rather than under a label repeating
what the screen already said, and they arrive with the same stagger as everything else.

And once a boy is chosen his name comes OFF the day cards: «فهو طالب واحد». Fourteen cards each
repeating the name at the top of the screen is fourteen copies of one fact; what changes down that
column is the DAY and the مقرّر, so that is what each card says.

**سجل التسميع on ملف الطالب is one week**, not five entries — «سجل التسميع يعرض سجل أسبوع واحد فقط».
A window is the right shape for this one: five entries could be five days or five weeks depending on
how often the boy came, and a teacher opening the page is asking «كيف كان أسبوعه». The window is
named in a chip on the heading rather than a subtitle under it — the subtitle went because it
described the columns beneath it, while WHICH WEEK is new information a reader needs to have.

### 12.5a2 وضع «فترة لطالب» — the box, the button, and the one that did nothing

**«امسح تسجيله» never fired on this screen.** Its save read `if (!d?.status) return` — and a CLEARED
card has no status, which is the whole point of it. The button was drawn, enabled, and inert, while
the identical button on التسجيل beside it worked. What has nothing to write is a card that was never
saved AND has nothing chosen; that is what the guard says now.

**The picker is cards on the page, not a list in a box.** A box around them gave the list its own
scroll inside the page's scroll, which is two rails for one column of names — «بطاقات أسماء الطلاب
في البحث لا يكونون داخل جدول» (client, 18 Sep 2026). Once a boy IS chosen the box comes back, because
then it holds one thing: who, and over what period.

**And there is no «اعرض» button.** The second tap on the calendar IS the request — «مباشرة من تحديد
يوم النهاية تتحدث البيانات». It had always been redundant, since the column re-reads whenever the
period changes; it only made the reader press twice for one decision.

### 12.5a3 مقرّرات الطلاب — rebuilt

«أعد تنسيقه وتصميمه من جديد، واحرص أن يطابق الهوية بكل تفاصيله» (client, 18 Sep 2026), and the
detail that broke it is §7.1a: the مقرّر field was five hundred pixels wide because `w-full` beat
`w-20`, so a six-column table read as a form.

It is a LIST now, the shape this product uses everywhere a person is a row: who he is on one line,
where he stands under it, and the one number being set held in a box the size of the number. The work
is «ضع رقمًا لمن ليس له رقم», so the ones without one are tinted in place and gathered by their own
filter — a chip beside the search rather than a tick box, because it filters like the two controls
next to it and a tick box among fields reads as a setting being saved.

### 12.5b الجرس، والصندوق، والزرّ الذي يظهر في وقته — the second client pass

Seven changes on 18 Sep 2026, after the first pass was on screen. They are recorded together because
five of them are the same principle: **a control that is always there says nothing.**

**«امسح تسجيله» appears only at its time.** The save button read the clear label whenever nothing was
chosen — which is also true of every untouched card on the screen, so twenty-five cards offered to
erase a day nobody had written yet. It now needs a card that WAS saved and has just been cleared.

**نقاط يومه — a box on the save row.** §١٢-ب's «ولا نقاط ولا حسابات في هذه الصفحة: هي صفحة تسجيل لا
صفحة تقييم» is **reversed here on the client's instruction**: he asked for the day's total beside the
save button. It stays inside the spirit of the rule as far as it can — a READOUT, nothing to grade
and nothing to type — and it is computed by `dailyAward`, the same function the server pays by, over
the point table the route hands down with the day. The table travels rather than being defaulted on
the client, because the supervisor may have switched to the first requirements document's figures
(§13's note), and a box on the card disagreeing with the ledger it writes would be worse than no box.
It counts the DRAFT, so it answers the tick just made rather than the card as opened. No box at all
on مسار التلقين or on a boy with no track: a permanent ٠ beside a save button reads as a score.

**حال اليوم on a day that is not a halaqa day says only that.** The paragraph under it explained that
an exceptional day may still be opened and that any day with تحضير counts — and the button directly
beneath it SAYS «افتح اليوم استثناءً». Same sentence, one tap.

**The hero's bottom corners are curved** even when it is full-bleed, and the section under it now
**arrives with the ordinary entrance** every other screen's content has. The hero itself still has
none (§12.3): it is what is already there when the screen opens. The stagger is carried by each
element rather than by one wrapper, because half of them arrive after the day is fetched and an
entrance played over an empty box is an entrance nobody sees.

**The page's own scrollbar** wears the indicator too. §12.5a put it on the portals' rails, but the
bar that runs down the whole screen belongs to the DOCUMENT, and a scrollbar is painted by the
scrolling element — `.portal` is a div inside the body and could never reach it. It is set on `html`
now, so one indicator runs down every surface in the product.

**سجل التسميع is three boxes, not three pills.** They wrapped, so «المراجعة الكبرى — لم يسمّع» took
its own line on a phone and the three stopped lining up between one day and the next. Three equal
columns answer in the same order and the same place every time: ما هو · سمّع أو لا · كم أخطأ. The
subtitle went — it described the columns directly under it — and the button says «صحّح السجل» on one
line, because a two-line button beside a one-line heading drags the head out of square. The DARS
box says «الدرس» rather than «الدرس — الحفظ الجديد»: the gloss does not fit ninety pixels at any size
worth reading, and beside «المراجعة الكبرى» and «المراجعة الصغرى» it cannot be read as anything else.
The full name still stands wherever there is a row for it.

### 12.5c التاريخ الهجري — the one place `<Num>` is the wrong tool

`Num` is `<bdi dir="ltr">`: §2.2's rule, and it is right for a figure that must not be taken apart by
the Arabic around it. A DATE is not one figure. «٧ ربيع الآخر ١٤٤٨» is two numbers with an Arabic
phrase between them, and forcing the whole thing LTR lays it out left-to-right — the day number
landing on the far side of the month from where an Arabic reader looks for it, and the year on the
other side again. The client saw it in the date field and said so: «نص التاريخ داخل خانة التاريخ
يكون بشكل أرتب من هذا» (18 Sep 2026).

`<HijriText>` isolates the two NUMBERS and lets the phrase between them flow with the line. It
replaced the joined string in all four places that showed one — the hero, the date field, the
period spine and سجل التسميع — so they cannot drift apart again. The Gregorian date in the field is
laid out the same way.

### 12.5d التنبيهات — a date, an order, and a bell

Alerts now carry **the day they are about**, and every kind has one: the pointer's date for
«يستحق الاختبار», the booking's day, the exam's, the plan's, and the newest absent day for a run of
absences. They are ordered **newest first** — «وتعرض من الأقرب إلى الأبعد» — and kind is only the
tiebreaker. A list sorted by category makes the reader ask which category a thing was filed under
before he can find it; a list sorted by time answers the question he actually has, which is what has
happened since he last looked. Each row shows both «أمس» and the date: the relative form for reading
at a glance, the absolute one for the record.

**The number on the bell is the UNREAD count, and nothing when nothing is unread** — «الرقم اللي عند
أيقونة الجرس يحسب أرقام التنبيهات غير المقروءة» (client, 18 Sep 2026). It used to fall back to the
total, which made a bell reading «٣» mean two different things on two afternoons, and the one that
matters — «ثلاثة تنتظرك» — is the one it stopped meaning. With nothing unread the bell is a door
rather than a summons.

**The bell rides in the hero, beside خروج**, on every screen the hero is on — so the alerts are one
tap from التسجيل and not only from الرئيسية. الرئيسية still shows five with «عرض المزيد» under them,
and that button opens the bell's own window: two doors, one room. The read-marker moved into
`MeProvider` with them: two things now show the same alerts at once, and two local copies of «what I
have already read» would disagree the moment one of them was tapped.

### 12.6b فرسان الأسبوع — a title, not a ranking

Added on the client's instruction (18 Sep 2026) and then defined by him: «فرسان الأسبوع ذكرنا
معاييرهم سابقًا، وهم من حقّقوا كل المتطلبات اليوم لمدة أسبوع، وهي: الحضور — الثوب — التسميع كامل.
ويكون فيه صفحة لطباعة أسماء الفرسان عند المشرف.»

**It is not a variant of لوحة الشرف, and the difference is the point.** That sheet ORDERS balances,
which is a question about the whole term: the same five names hang there for weeks, and a boy who
joined last month cannot reach that wall however hard he works. This one NAMES everyone who did
everything asked of him on every day his halaqa met this week. There is no first and no fifth; some
weeks it is empty, and an empty week is a true thing to pin up.

Two readings were settled here, and both are recorded because each NARROWS the gate rather than
widening it:

> **«الحضور» is `PRESENT`, not `countsAsPresent`.** متأخر is a present boy everywhere else in this
> system — the states are for follow-up and this portal has no deduction in it — but «حقّق كل
> المتطلبات» is a statement of perfection for the week, and arriving late is not perfect. He keeps
> his points; he does not get the title.
>
> **«أيام الأسبوع» are the days the halaqa was REGISTERED on**, not the days its weekday setting says
> it opens. That follows the calendar rule of 17 Sep 2026 — «أيّ يوم فيه تحضير يُعتبر يوم حلقة» — so
> a day nobody registered cannot be a day a boy failed to attend, and a halaqa that met exceptionally
> on a Saturday counts that Saturday. Each halaqa is judged on its OWN days, so one that met four
> times does not cost its boys the title because the halaqa beside it met five.

**And an exam he PASSED is a met day on its own.** «واللي عنده اختبار، إذا اختبر واجتاز، يُحسب ذلك
اليوم أنه حقّق المتطلب لذلك اليوم» (client, 18 Sep 2026). It stands alone — it does not ask for
attendance or a thobe beside it — because a boy sitting his badge exam is with the examiner and not
in his halaqa's row, and there may be no تحضير for him that afternoon at all. What was required of
him that day was the exam, and he passed it. Failing it is not a met day: the condition is «اجتاز».

A boy with nothing to recite and no exam passed — مسار التلقين, no plan issued, or stopped at a badge
مقرّر and still waiting — cannot be a فارس, because a week of nothing recited is not a week of
«التسميع كامل».

The rule is `knightOfWeek` in `lib/teacher.ts`, tested there; the rows are read by `lib/knights.ts`,
which BOTH sheets use — the teacher's own halaqa and the supervisor's across the mosque. Two
resolvers would have been two definitions of a title children are named by, and they would have
drifted the first time either was touched. The sheet prints its criterion on itself: a name pinned to
a wall without its condition is a name that gets argued about.

### 12.6c1 النقاط اليومية — عمودان، كلاهما يُكتب

The golden track was a MULTIPLIER over the silver one — ×٢ on the three recitation lines, ×١ on
الحضور and الثوب — and the split itself was an open question we had put to the client. He closed both
halves of it on 18 Sep 2026: «أبي خانة الذهبي قابلة للتعديل، والمضاعفة تشمل الحضور والثوب وليست
مفصولة».

So ذهبي is a COLUMN of five figures like فضي, and the multiplier survives only as a button that FILLS
that column in one stroke — one factor over all five, which is «ليست مفصولة» made structural rather
than argued. Nothing is multiplied at pay time any more: what a supervisor reads in the ذهبي column
is what a golden boy is paid, digit for digit. That is also the shape of the client's own paper,
which lists the two tracks as rows of one table and never mentions a factor.

**A database written before the change keeps paying what it paid.** `readDaily` reads an old
`{ lines, attendance }` value as what it MEANT — the silver table at those factors — rather than
discarding it for the default. The approved default column is the same: lines doubled, attendance and
thobe as they are.

The card also moved from المعلمون to النقاط, «بلوك النقاط اليومية في صفحة المعلمون انقلها إلى صفحة
النقاط»: it had been filed where it came FROM rather than by what it is, and النقاط is where every
figure that pays now lives. The two warning blocks went with it — the economy note and the
first-document comparison had both been read and decided.

### 12.6d تقرير تسجيل المعلم — أسبوع حلقة على ورقة عرضية

«فيه أسماء الطلاب في صفوف، والأيام في أعمدة، وفيها ٤ خانات لكل من الثوب والدرس والمراجعتين، والحضور
أو التأخير يُعلَّم يومه بلون الحالة أخضر أو أصفر، والغائب يُسجَّل يومه بـ«-»، وتكون بيانات لأسبوع واحد،
وآخر عمود في خانة فارس ويضع صح إذا كان الطالب فارسًا أو رقمًا لتحديد كم يوم أنجز» (client, 18 Sep
2026).

It is the teacher's own week read back as he would have written it on paper, which is what makes it
checkable: a supervisor holding it sees in one glance who came, who wore his thobe, who recited what,
and who finished the week whole. **Landscape**, for the same reason الورقة الأسبوعية is — five days
times four marks plus a name and a verdict is twenty-two columns, and twenty-two columns do not fit a
portrait page at a size anyone reads.

**The columns are the REGISTERED days**, not the weekday setting — «أيّ يوم فيه تحضير يُعتبر يوم
حلقة», the same rule the فرسان sheet counts by. An exceptional Saturday gets a column; a Sunday
nobody opened does not.

**A blank and a dash are different facts.** «الغائب يُسجَّل يومه بـ-», so an empty cell can only ever
mean «لم يُسجَّل له» — a day his teacher did not reach, which is not an absence and must not be
readable as one. And every mark carries a SHAPE as well as a colour (§1.4), because this comes out of
a photocopier.

The فارس column is `knightOfWeek` itself rather than a second opinion about it: one definition of a
title children are named by, whether it is being printed on their wall or checked on a supervisor's
desk.

**WHO THE ROW IS, BEFORE WHAT HE DID IN IT** — «عمود الاسم أبيه يكون أصغر، وأضف عمود المسار والمستوى
وأي مقرّر وصل له، ووسّع خلايا المقررات» (client, 18 Sep 2026). A tick under الدرس means nothing on its
own: the supervisor reading the page is asking whether a boy on المستوى الثالث at مقرّر ١٢ recited
what ١٢ actually is, and without those three columns he had to hold a hundred and seventeen pointers
in his head to read one sheet. They resolve in the same order `lib/day.ts` resolves them — pointer,
then issued plan, then the level on the student's own record — so the sheet cannot disagree with the
card his teacher was looking at. A talqeen boy gets a dash in both, because «لا مستوى له ولا منهج».

The name gave up the width for them, and the table is **`table-fixed`**: every column that names who
the boy is has its own width, and what is left over is shared EQUALLY by the mark cells. A name is
read once and the marks are read twenty times, and a tick that has to be aimed at is a tick that gets
misread.

### 12.6e دفتر المواعيد — تصفية، وتعديل، واختبار الجمعية

«أبي خيارات تصفية بالوسام أو الوقت (أُجري — اليوم — محجوز — أُلغي)، وزر في السجل
ينقلني لصفحة الاختبار التي ضغطت عليها مباشرة، وأبي إمكانية تعديل تفاصيل حجز
اختبار — تضيف أيقونة قلم بجانب أيقونة الحذف» (client, 18 Sep 2026).

Four hundred appointments are a LEDGER, not a list. The book is opened with a
question already in mind — who is sitting today, what is still open, what was
already done — and one column of every booking ever made answers none of them.
The counts ride on the chips, so the shape of the book is readable before
anything is clicked. `اليوم` is a CUT of `محجوز` rather than a status of its own:
a booking is not in a fifth state because its day happens to be this one.

**The filters live in the SIDE PANEL**, not over the table — «خيارات التصفية تكون في البار الجانبي
وليس فوق» (client, 18 Sep 2026). That is where every other screen keeps them (§4), so the table gets
its width back and the eye looks in one place for them on every screen; and because they travel in
the URL, a cut of the book is a link. The screen says which cut it is showing above the table, so a
short list never looks like a short book.

**A booking is CORRECTED, not cancelled and re-made.** Moving a date used to mean
one «أُلغي» row describing nothing that ever happened, plus a new row that lost
the note. Editing is allowed only while it is «محجوز» — once it is DONE the exam
is the record, and editing a CANCELLED one would quietly resurrect something that
was called off.

**«في السجلّ» lands on the sitting itself.** `/admin/exams?exam=<id>` opens that
record and unfolds the boy's earlier ones under it. Finding one sitting among
four hundred by scrolling is not an answer.

**ومتى يُحجز اختبار الجمعية؟** «بعد الوسام الماسي للمستويات الذهبية جميعها، أو
بعد الوسام الماسي للمستويات الفردية للمسار الفضي» (client) — which is §4.8 said
from the other end, and nothing new is judged for it. The diamond is the proof a
JUZ was completed; every golden level is a juz and the silver track takes two, so
only its ODD levels land on a whole one. `readyForAssociation` already knew all
of that (`ajzaForLevel` returns null mid-juz on purpose), so the badge is offered
by the same rule that names the ready students — and when it is not offered, the
screen says WHY rather than leaving the choice greyed and unexplained.

### 12.6f تقدّم الحلقات — اليوم على الرئيسية، والفترة في التقارير

«أبيك تعرض إحصائيات اليوم فقط، ولا تعرض متوسطات بل إجمالي، وإحصائيات الفترة تكون
في التقارير» (client, 18 Sep 2026), ثم: «أبي نفس الجدول ونفس الأعمدة اللي كانت
موجودة أول، لكن بس حسبة اليوم».

One heading was answering two questions. The table was the last رتل file — a
term's totals and their per-student averages — on the screen the supervisor opens
at four o'clock to ask what is happening now. So the arithmetic changed and
nothing else did: same table, same columns, same track chips, and the three
figures counted from what the teachers have registered TODAY. The term's figures
are a report now (`/print/progress`), where a period is chosen deliberately.

The three are COUNTS OF STUDENTS, not pages. رتل's «أوجه» are pages over a term
and the registration screen records no pages at all — it records who recited what
this afternoon — so the headings say what they now hold rather than borrowing a
word that would make twelve boys look like twelve pages. And a halaqa that has
not opened its day says so: an afternoon nobody has registered is not an
afternoon of noughts, and that difference is the first thing the row must carry.

### 12.6g حسبة الأوجه — قاعدة في قاعدة البيانات، لا في الشيفرة

«حسبة الأوجه أبيك تحطها كما هي موجودة عندك في الصورة، وتكون مربوطة بقاعدة
البيانات فقط، ما يحتاج تذكر تفاصيلها للعلن» (client, 18 Sep 2026), مع ورقة
«مسارات الحفظ».

What the sheet says, and what the system now computes with:

| | الذهبي (٣٠ مستوى · جزء لكل مستوى) | الفضي (٦٠ مستوى · حزب لكل مستوى) |
|---|---|---|
| الدرس الجديد | وجه | نصف وجه |
| المراجعة الصغرى | آخر ثلاثة دروس | آخر درسين |
| المراجعة الكبرى | ١٠ أوجه حتى الجزء ١٠ · ١٥ حتى ٢٠ · ٢٠ بعدها | ٥ أوجه حتى الجزء ٥ · ١٠ حتى ١٥ · ١٥ بعدها |

Three things are deliberate:

> **It is a ROW, not a constant.** `settings.memorisation_pages`, seeded by a
> migration and read on every request. A figure changes with one `UPDATE`
> rather than a deployment — «تكون مربوطة بقاعدة البيانات».
>
> **The small review is stored as the SENTENCE, not the answer.** «آخر ثلاث
> دروس» is kept as a count of lessons and multiplied by the lesson's own size,
> so it stays right on both tracks: three golden lessons are three pages, two
> silver ones are one. Storing «٣ أوجه» would have been correct on one track
> and wrong on the other.
>
> **Nothing prints the bands.** «ما يحتاج تذكر تفاصيلها للعلن»: the screens show
> the totals the rule produced — «أوجه الحفظ» و«أوجه المراجعة» — and never the
> table behind them.

The juz a boy is in is read from his LEVEL, since both tracks count down: golden
is `31 − level`, silver is `⌈(61 − level) ÷ 2⌉`. A boy with no level recorded
contributes nothing rather than being counted from the first juz — these figures
are summed across a halaqa, and a guess is indistinguishable from a fact once
added up. And the pages are counted from the LINES that were recited, never from
the roster: a boy who came and did not recite adds nothing, which is the whole
point of a number read at four o'clock.

### 12.6c رسائل الإدارة — the door at the supervisor's end

The teacher's half shipped with his portal: a message lands in تنبيهات حلقتي with a «من الإدارة» mark
and an unread dot. The half that was missing was the way to send one, so until now the only way to
reach a teacher was to write a row by hand. «وين ممكن تضيف خيار إرسال رسالة للمعلمين عند المشرف،
أبيها تكون قابلة للتخصيص — يعني يحدد من المعلمين اللي يرسله لهم» (client, 18 Sep 2026).

**Addressing is a row per reader, not a list inside one row.** `admin_messages` carries `teacherId`
and `studentId`, each null meaning «to all of that audience». So sending to three teachers writes
three rows — and that is not a workaround. The read-marker is keyed `MESSAGE:<id>`, so one shared row
would mean the first reader ticked it off for everybody. A broadcast stays ONE row, because it is one
announcement and a hundred identical rows would be a hundred rows to withdraw.

**And to the students too** (18 Sep 2026) — «ويمكن يرسل رسائل للطلاب والمعلمين». `audience` is a
COLUMN and not an inference from which id is set, because a broadcast has neither id and «to
everyone» must still say to everyone of WHICH kind. A teachers' announcement landing on a child's
screen is the one mistake this table must make impossible, so both readers filter on it.

**FOUR WAYS TO NAME THE STUDENTS** (18 Sep 2026) — «كل الطلاب، بالحلقة، بالمسار، طلاب بعينهم». The
first three are ONE decision each; ticking a halaqa's thirteen boys one at a time is thirteen chances
to miss one, and the set is resolved on the SERVER so «إلى حلقة هشام» means the halaqa as the
database has it at the moment of sending rather than as some screen last loaded it.

The fourth is a SEARCH, not a wall of names: «خانة بحث تظهر الأسماء في قائمة منسدلة بعد كتابة حرفين،
وتحديد الاسم والتنقل فيها، وتظهر أسماء الطلاب الذين تم تحديدهم». A hundred and seventeen chips is not
a list anyone reads, so nothing appears until two letters narrow it, ↑↓ walk the hits, Enter takes
one, and what has been taken shows as chips underneath — the only place the chosen names belong,
because that is the answer to «من اخترت؟».

**HOW LONG THE LIST IS DECIDES HOW IT IS SHOWN** (18 Sep 2026) — «قائمة المعلمين في الرسائل الجديدة
تكون ظاهرة جميعها» و«تحديد الحلقات في الطلاب يمكن الاختيار من متعدد، وأظهر الحلقات كلهم في أقراص
مستطيلة». Eight teachers and nine halaqat are a SHORT list, and a short list behind a search field is
a list nobody can see before guessing at it — the dropdown was taller than the thing it covered. Both
are laid out whole now, as rectangles that toggle, each carrying its own count because «إلى الحلقتين»
is a decision about how many boys it reaches. A hundred and seventeen students stay behind the
search, for the same reason in reverse.

And the halaqat take MORE THAN ONE. «رسالة لحلقتين» was two sends before — two cards, two
withdrawals, and the same words typed twice; it is one send with two names on its label now. The set
is still resolved on the server, so it means the halaqat as the database has them at the moment of
sending.

**ONE CARD PER SEND, with who it went to.** Addressing stays a row per reader — that is what makes
each copy tickable on its own — and `groupId` is what puts the rows back together for the person who
wrote them: «كل رسالة في بطاقة وحدة ومعها لمن أُرسلت هذه الرسالة، وليس كل شخص في بطاقة لوحده». Six
names show and the rest are one tap away. `scopeLabel` records HOW they were chosen and is stored
rather than derived, because a boy who has since left a halaqa would otherwise make an old send
describe itself wrongly. Withdrawing takes the whole send and its read-markers with it.

**Its own page, and a door in the shortcuts.** «قسم رسائل الإدارة عند المشرف يكون لها صفحة خاصة في
الإعدادات … ويكون لها اختصار في السوبر بار في الصفحة الرئيسية». Everything else under الإعدادات sets
a figure or issues an account; this reaches a phone in someone's hand, and it was four clicks deep.
The screen asks its three questions in the order that narrows: which audience, then whom of it, then
what to say — the audience first because it changes who the list below IS.

The door began in the top bar and moved into «اختصارات» — «أبي زرّ رسالة للمعلمين والطلاب تكون ضمن
الاختصارات وليس في الترويسة» (18 Sep 2026). The bar carries the screen's own title and its search; a
destination among those reads as an action ON this screen, which it is not.

**«إلى الجميع» is a toggle, never an empty selection.** A message that went to seven teachers because
nobody was ticked is the one mistake this screen must not make, so the server refuses an unaddressed
send rather than treating it as a broadcast. The button says how many it is about to reach before it
is pressed, and what was sent stays on the screen with a read count beside it — «أرسلتها» and
«قرأها» are different facts, and a supervisor asking «هل وصلت؟» is asking the second one. Each one
can be withdrawn, and its read-markers go with it.

### 12.7 What is NOT on this surface

No exam screen of any kind, not even the mock. No plan issuing or editing. **No setting a student's
مقرّر** — the client's decision of 18 Sep 2026, and the reason `الإعدادات ← المعلمون` grew a third
card (and a fourth, §12.6c). No discretionary points, no codes, no gift delivery, no deduction. No other halaqa, ever — and that last one is enforced at
`/api/teacher/_scope.ts`, where the halaqa comes from the cookie and a `?halaqa=` in the URL is
ignored rather than honoured.
