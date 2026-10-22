/* التلقين as recitation lines — so the supervisor sees what a talqeen boy read.

   «حلقات التلقين في المتابعة ما يظهر شنو سمّع … وتسجيله للجديد والمراجعة
   أبيه يطلع في المتابعة عند المشرف» (client, 22 Oct 2026).

   A talqeen boy has no plan, so his day carries no `recitation_lines`: what his
   teacher wrote is a position (آخر سورة وآية حفظها) and, since 22 Oct, the
   surahs he went back over. Every screen that reads recitation reads LINES —
   the register's «سمّع» column, the day's detail, the reports' recited days —
   so this turns those fields into the same shape: «الحفظ» and «المراجعة», each
   recited, no errors counted (none are recorded for talqeen). One place, so the
   follow-up and the printed reports can never disagree about it. */

export type TalqeenFields = {
  talqeenSurah?: string | null;
  talqeenAyah?: number | null;
  talqeenReviewFrom?: string | null;
  talqeenReviewTo?: string | null;
};

export type TalqeenLine = {
  kind: 'TALQEEN_NEW' | 'TALQEEN_REVIEW';
  kindAr: string;
  recited: true;
  errors: 0;
  note: null;
  passage: string;
};

export function talqeenLines(e: TalqeenFields): TalqeenLine[] {
  const out: TalqeenLine[] = [];
  if (e.talqeenSurah) {
    out.push({
      kind: 'TALQEEN_NEW', kindAr: 'الحفظ', recited: true, errors: 0, note: null,
      passage: `${e.talqeenSurah}${e.talqeenAyah != null ? ` حتى الآية ${e.talqeenAyah}` : ''}`,
    });
  }
  if (e.talqeenReviewFrom) {
    out.push({
      kind: 'TALQEEN_REVIEW', kindAr: 'المراجعة', recited: true, errors: 0, note: null,
      passage: e.talqeenReviewTo ? `من ${e.talqeenReviewFrom} إلى ${e.talqeenReviewTo}` : e.talqeenReviewFrom,
    });
  }
  return out;
}
