import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { readSession, hashPin, LOGIN_ID_FIRST } from '@/lib/auth';

/* ملف حسابات الطلاب — الحلقة · الطالب · رقم الدخول · كلمة المرور.

   Nothing here is a generated secret, so producing the file changes nothing:
   the login number is the one already stored, and the password is the boy's own
   national id. This can be exported a hundred times and every sheet stays
   valid — which is the point of the scheme the client asked for. */

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
  const taken = new Set(creds.map((c) => c.username));
  let next = LOGIN_ID_FIRST;
  const nextFree = () => {
    while (taken.has(String(next))) next++;
    const id = String(next); taken.add(id); return id;
  };

  const rows: Record<string, string | number>[] = [];

  for (const st of students) {
    if (!st.nationalId) {
      rows.push({
        'الحلقة': st.halaqaId ? halaqaName.get(st.halaqaId) ?? '' : '',
        'الطالب': st.fullName,
        'رقم الدخول': '—',
        'كلمة المرور': '—',
        'ملاحظة': 'بلا رقم هوية — يحتاج تعيينه قبل إنشاء حسابه',
      });
      continue;
    }

    /* An existing login number is never reissued — a boy has it written down. */
    const mine = existing.get(st.id);
    const username = mine?.username ?? nextFree();
    if (!mine) {
      await db.studentCredential.create({
        data: { studentId: st.id, username, pinHash: await hashPin(st.nationalId),
                mustChangePin: false },
      });
    }

    rows.push({
      'الحلقة': st.halaqaId ? halaqaName.get(st.halaqaId) ?? '' : 'بلا حلقة',
      'الطالب': st.fullName,
      'رقم الدخول': username,
      'كلمة المرور': st.nationalId,
      'ملاحظة': '',
    });
  }

  await db.auditLog.create({
    data: { actorId: s.sub, action: 'STUDENT_CREDENTIALS_EXPORT',
            entity: 'student_credential', entityId: `${rows.length} طالبًا` },
  }).catch(() => { /* the file matters more than the trail */ });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 34 }];
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
