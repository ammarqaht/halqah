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
| بعذر / معلومة | `info` | ▭ outlined square |
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
| الطلاب | **Live filter surface** — halaqa, track, stage, status, level range, with result counts per option |
| الحلقات | Halaqa list; selecting one filters the work area |
| الخطط | Student queue — who is waiting for a plan, who is late |
| الاختبارات | Booking queue for the day, and exam-type filter |
| النقاط والمتجر | Batch list / gift categories / order status |
| المتابعة | Saved lists — ready for association, late on level, not examined |
| التقارير | Report kind, scope, period |
| الإعدادات | Settings tabs |

- Collapses with the TopBar toggle when the table needs full width. State persists per section.
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
Two columns. In RTL the **brand panel is on the right**, the form on the left at a fixed 480px.

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

### 5.2 The opening animation
A single continuous motion, ~1.6s total. Runs **once per browser session** (`sessionStorage`), so the
supervisor logging in daily is not taxed 3 seconds every time.

| t | What happens |
|---|---|
| 0 → 400ms | Full-bleed `page` ground. The **complete logo lockup** fades in at the centre, at `height: 96px`, from `opacity 0 / scale 0.96` |
| 400 → 900ms | It holds. Nothing else on screen |
| 900 → 1500ms | The logo **travels to its resting position** in the brand panel and scales to `46px`, on a single `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| 1100 → 1600ms | Overlapping: the brand panel wipes in from the right edge, the form column fades up 12px, and the lattice cross-fades to 5% |
| 1600ms | `autofocus` lands on the login field |

Implementation notes:
- Animate **`transform` and `opacity` only.** A layout animation on the panel would make every
  `fixed`/`sticky` descendant position against it instead of the viewport.
- Use one shared element for the logo (FLIP), so the mark never re-renders or flickers mid-flight.
- **`prefers-reduced-motion: reduce` → skip to the settled state**, no exceptions.
- The form is present in the DOM and focusable from t=0. The animation must never gate input.

---

## 6. Navigation map — mockups reconciled with the approved scope

The mockups' rail is wrong for this product. This is the correct one, derived from `SPEC.md` §6–§7.

### Rail (top group — daily work)
| Icon | Label | Route | SPEC ref |
|---|---|---|---|
| home | الرئيسية | `/admin` | إد-٢ |
| users | الطلاب | `/admin/students` | إد-٣-أ |
| circles | الحلقات | `/admin/halaqat` | إد-٣-ب |
| doc | الخطط | `/admin/plans` | إد-٥-أ |
| check-square | الاختبارات | `/admin/exams` | إد-٥-ب · إد-٥-ج |
| coins | النقاط والمتجر | `/admin/points` | إد-٤-أ · ب · ج |
| chart | المتابعة والتقارير | `/admin/follow-up` | إد-٥-د · هـ |

### Rail (foot group)
| gear | الإعدادات | `/admin/settings` |
| logout | تسجيل الخروج | — |

### Removed from the mockups
- **التحضير (attendance)** — stays in Ratel. We *display* attendance from the weekly import; we never capture it.
- **التسميع (recitation logging)** — stays in Ratel. Explicitly out of scope in the approved PDF.
- **واجهة ولي الأمر** — not in phase 1.
- **حسابات المعلمين** — phase 2. The rail has room; the entry appears when it ships.

### Student portal — no rail
Four routes, a bottom tab bar on mobile, a slim top bar on desktop:
`الرئيسية` · `شحن كود` · `المتجر` · `مستواي وخطتي`. Reading density, display headings, big touch targets.

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

**Open:** exact icon set (Lucide is the working assumption — it is what the mockups use and it ships
tree-shaken), and the lattice tile geometry, which will be lifted from Mockup A's `<pattern>`.
