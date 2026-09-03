'use client';
import { useState } from 'react';
import { Modal, Btn, Field } from '@/components/ui';
import { Combobox } from '@/components/Combobox';
import { TRACK_AR } from '@/lib/types';
import { shortName } from '@/lib/normalise';
import { store, useDB } from '@/lib/store';
import { Num } from '@/components/Num';

export function MoveDialog({ open, ids, onClose }:
  { open: boolean; ids: string[]; onClose: () => void }) {
  const db = useDB();
  const [target, setTarget] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`نقل ${ids.length} طالبًا إلى حلقة`}
      footer={<><Btn onClick={onClose}>إلغاء</Btn>
        <Btn variant="primary" onClick={() => { store.moveStudents(ids, target || null); onClose(); }}>نقل</Btn></>}>
      <Field label="الحلقة الجديدة">
        <Combobox value={target} onChange={setTarget}
          options={[{ value: '', label: '— بلا حلقة —' },
                    ...db.halaqat.map((h) => ({ value: h.id, label: shortName(h.teacher),
                                                hint: h.track ? TRACK_AR[h.track] : h.timeSlot }))]}
          placeholder="اختر الحلقة" searchPlaceholder="ابحث باسم المعلّم…" />
      </Field>
      <p className="mt-4 rounded-lg bg-page px-3 py-2.5 text-panel text-ink-600">
        ينتقل مع الطالب كل تاريخه — نقاطه ومستواه واختباراته. لا يبدأ من الصفر.
      </p>
    </Modal>
  );
}
