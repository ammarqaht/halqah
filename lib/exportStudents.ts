/* سحب بيانات الطلاب كملف Excel — «سحب بيانات الطلاب كملف اكسل» (client,
   22 Oct 2026).

   Exactly the list on the screen: the halaqa, the filters and the search the
   supervisor has on are what he gets, in the same order. The sheet reads
   right-to-left, and every id and phone is written as TEXT — Excel otherwise
   turns «0551234567» into 551234567 and a national id into 1.17E+09. */
import type { Halaqa, Student } from '@/lib/types';
import { TRACK_AR, STATUS_AR } from '@/lib/types';

export async function exportStudents(rows: Student[], halaqat: Halaqa[], name: string) {
  const XLSX = await import('xlsx');
  const halaqaOf = new Map(halaqat.map((h) => [h.id, h]));

  const head = ['#', 'الطالب', 'رقم الهوية', 'المسار', 'المستوى', 'الحلقة', 'المعلم',
    'الصف', 'المرحلة', 'الجنسية', 'جوال ولي الأمر', 'تاريخ الميلاد', 'الحالة'];
  const body = rows.map((s, i) => {
    const h = s.halaqaId ? halaqaOf.get(s.halaqaId) : undefined;
    return [
      i + 1,
      s.fullName,
      s.nationalId ?? '',
      s.track ? TRACK_AR[s.track] : '',
      s.track !== 'TALQEEN' && s.currentLevel != null ? s.currentLevel : '',
      h?.name ?? '',
      h?.teacher ?? '',
      s.grade ?? '',
      s.stage ?? '',
      s.nationality ?? '',
      s.guardianPhone ?? '',
      s.birthDate ?? '',
      STATUS_AR[s.status] ?? s.status,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
  /* Text, not numbers: ids and phones keep their leading zeros and digits. */
  for (let r = 1; r <= body.length; r++) {
    for (const c of [2, 10]) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref]) { ws[ref].t = 's'; ws[ref].v = String(ws[ref].v); ws[ref].z = '@'; }
    }
  }
  ws['!cols'] = [4, 28, 14, 8, 7, 34, 26, 12, 10, 10, 14, 12, 8].map((wch) => ({ wch }));
  ws['!views'] = [{ RTL: true }] as never;

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
  const day = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${name} — ${day}.xlsx`);
}
