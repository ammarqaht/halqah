import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { readSession, hashPin, PIN_LENGTH } from '@/lib/auth';

/* ملف حسابات الطلاب — the one place a PIN exists in the clear.
   Everywhere else it is a bcrypt hash and therefore unrecoverable by design:
   nobody, including this system, can read a boy's PIN back. So a sheet of them
   can only be produced by SETTING them, which is what this does — it mints a
   fresh PIN for every account and hands the workbook back once.
   Every PIN it prints is therefore live, and every PIN printed before it is
   dead. That is stated on the screen that calls this. */

function freshPin(): string {
  for (;;) {
    let pin = '';
    for (let i = 0; i < PIN_LENGTH; i++) pin += randomInt(0, 10);
    if (/^(\d)\1{4}$/.test(pin)) continue;
    if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) continue;
    return pin;
  }
}

export async function POST() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const [students, halaqat, creds] = await Promise.all([
    db.student.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ halaqaId: 'asc' }, { fullName: 'asc' }] }),
    db.halaqa.findMany(),
    db.studentCredential.findMany(),
  ]);
  const halaqaName = new Map(halaqat.map((h) => [h.id, h.teacher || h.name]));
  const existing = new Map(creds.map((c) => [c.studentId, c]));
  const taken = new Set<string>();

  const rows: Record<string, string | number>[] = [];

  for (const st of students) {
    if (!st.nationalId) {
      rows.push({
        'الحلقة': st.halaqaId ? halaqaName.get(st.halaqaId) ?? '' : '',
        'الطالب': st.fullName,
        'اسم الدخول': '— بلا رقم هوية —',
        'الرمز': '',
        'ملاحظة': 'يحتاج رقم هوية قبل إنشاء حسابه',
      });
      continue;
    }

    /* Two boys under one national id is a real thing in this roster. The first
       keeps it bare; the rest take a suffix, and the sheet says so. */
    let username = existing.get(st.id)?.username ?? st.nationalId;
    if (!existing.has(st.id)) {
      let n = 2;
      while (taken.has(username) || creds.some((c) => c.username === username && c.studentId !== st.id)) {
        username = `${st.nationalId}-${n++}`;
      }
    }
    taken.add(username);

    const pin = freshPin();
    await db.studentCredential.upsert({
      where: { studentId: st.id },
      create: { studentId: st.id, username, pinHash: await hashPin(pin), mustChangePin: true },
      update: { username, pinHash: await hashPin(pin), mustChangePin: true,
                failedAttempts: 0, lockedUntil: null },
    });

    rows.push({
      'الحلقة': st.halaqaId ? halaqaName.get(st.halaqaId) ?? '' : 'بلا حلقة',
      'الطالب': st.fullName,
      'اسم الدخول': username,
      'الرمز': pin,
      'ملاحظة': username === st.nationalId ? '' : 'هوية مشتركة — أُضيف رقم للتمييز',
    });
  }

  await db.auditLog.create({
    data: { actorId: s.sub, action: 'STUDENT_CREDENTIALS_EXPORT',
            entity: 'student_credential', entityId: `${rows.length} طالبًا` },
  }).catch(() => { /* the file matters more than the trail */ });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 32 }, { wch: 16 }, { wch: 10 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, 'حسابات الطلاب');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="halqah-student-accounts.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
