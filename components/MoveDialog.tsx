'use client';
import { useState } from 'react';
import { Modal, Btn, Field, INPUT } from '@/components/ui';
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
        <select className={INPUT} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— بلا حلقة —</option>
          {db.halaqat.map((h) => <option key={h.id} value={h.id}>{h.teacher} · {h.timeSlot}</option>)}
        </select>
      </Field>
      <p className="mt-4 rounded-lg bg-page px-3 py-2.5 text-panel text-ink-600">
        ينتقل مع الطالب كل تاريخه — نقاطه ومستواه واختباراته. لا يبدأ من الصفر.
      </p>
    </Modal>
  );
}
