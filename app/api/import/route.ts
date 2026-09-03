import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readSession } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

/* Commits a parsed file. The parsing happened in the browser — it is pure and
   needs no server — but the WRITE lands here, in one transaction, so an upload
   reaches every screen in the system instead of one browser tab.

   Three rules, the same ones the preview promised:
     1. never delete
     2. never blank a field the file does not carry
     3. halaqat are matched by name, so links never dangle across imports  */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const { students = [], halaqat = [], fileName = '', sheetName = '', kind = '' } = await req.json();
  if (!Array.isArray(students)) return NextResponse.json({ error: 'صيغة غير صالحة' }, { status: 400 });

  const started = Date.now();
  try {
    const result = await db.$transaction(async (tx) => {
      /* Halaqat first: students point at them. Matched by NAME, because each
         parse mints fresh ids that mean nothing outside their own batch. */
      const idByIncoming = new Map<string, string>();
      for (const h of halaqat) {
        const name = String(h.name || '').trim();
        if (!name) continue;
        const existing = await tx.halaqa.findUnique({ where: { name } });
        const saved = existing ?? await tx.halaqa.create({
          data: {
            name,
            teacher: h.teacher || '',
            mosque: h.mosque || 'جامع محمد العبدالكريم — حي أُحد',
            timeSlot: h.timeSlot || 'العصر',
            track: h.track || null,
          },
        });
        idByIncoming.set(h.id, saved.id);
      }

      /* Read once, not once per row. Doing a findUnique per student meant a
         round trip to Riyadh for each of them — 204 trips for one file. */
      const keys = students
        .map((s: any) => s.dedupeKey || s.nationalId || s.fullName)
        .filter(Boolean) as string[];
      const existing = await tx.student.findMany({
        where: { dedupeKey: { in: keys } },
      });
      const byKey = new Map(existing.map((e) => [e.dedupeKey!, e]));

      const toCreate: Prisma.StudentCreateManyInput[] = [];
      const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
      let flagged = 0;

      for (const s of students) {
        const key = s.dedupeKey || s.nationalId || s.fullName;
        if (!key) continue;
        if (s.nationalIdFlag) flagged++;

        const halaqaId = s.halaqaId ? idByIncoming.get(s.halaqaId) ?? null : null;

        /* Only fields the file actually carries. A Ratel report has no
           «المسار» column; silence means unchanged, not "clear it". */
        const patch: Record<string, unknown> = {};
        const set = (k: string, v: unknown) => {
          if (v !== null && v !== undefined && v !== '') patch[k] = v;
        };
        set('fullName', s.fullName);
        set('nationalId', s.nationalId);
        set('nationalIdFlag', s.nationalIdFlag);
        set('track', s.track);
        set('halaqaId', halaqaId);
        set('grade', s.grade);
        set('stage', s.stage);
        set('nationality', s.nationality);
        set('guardianPhone', s.guardianPhone);
        if (s.attended !== undefined && s.attended !== null) patch.attended = s.attended;
        if (typeof s.hifzPages === 'number') patch.hifzPages = s.hifzPages;
        if (typeof s.reviewPages === 'number') patch.reviewPages = s.reviewPages;

        const prev = byKey.get(key);
        if (!prev) {
          toCreate.push({
            dedupeKey: key,
            fullName: s.fullName,
            nationalId: s.nationalId || null,
            nationalIdFlag: s.nationalIdFlag || null,
            track: s.track || null,
            halaqaId,
            grade: s.grade ?? '',
            stage: s.stage ?? '',
            nationality: s.nationality ?? '',
            guardianPhone: s.guardianPhone ?? '',
            attended: s.attended ?? null,
            hifzPages: typeof s.hifzPages === 'number' ? s.hifzPages : null,
            reviewPages: typeof s.reviewPages === 'number' ? s.reviewPages : null,
          });
        } else {
          /* Skip rows that changed nothing: a re-upload of an unchanged file
             should cost almost nothing. */
          const differs = Object.entries(patch).some(([k, v]) => {
            const cur = (prev as Record<string, unknown>)[k];
            return String(cur ?? '') !== String(v ?? '');
          });
          if (differs) toUpdate.push({ id: prev.id, data: patch });
        }
      }

      if (toCreate.length) await tx.student.createMany({ data: toCreate });
      /* Updates still go one by one — each row gets different values — but only
         the rows that actually changed, which is usually a handful. */
      for (const u of toUpdate) await tx.student.update({ where: { id: u.id }, data: u.data });

      const created = toCreate.length;
      const updated = toUpdate.length;

      await tx.importRun.create({
        data: {
          fileName, sheetName, kind,
          rowCount: students.length, created, updated, flagged, skipped: 0,
          importedBy: session.sub,
        },
      });

      return { created, updated, flagged, halaqat: idByIncoming.size };
    }, { timeout: 120_000 });

    return NextResponse.json({ ok: true, ...result, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json(
      { error: 'تعذّر الاستيراد', detail: e instanceof Error ? e.message.split('\n')[0] : '' },
      { status: 500 });
  }
}
