import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, newId } from '../../db/db';
import { dateStr, dayOf, fmtDay, fmtTime, localTime } from '../../domain/time';
import type { Med } from '../../domain/types';
import { Header, Modal } from '../components/common';
import { useMeds } from '../data';

function MedEditor(props: { med: Med; isNew: boolean; onClose: () => void }) {
  const [m, setM] = useState(props.med);
  const set = (p: Partial<Med>) => setM({ ...m, ...p });
  return (
    <Modal title={props.isNew ? 'Add medication or supplement' : m.name} onClose={props.onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!m.name.trim()) return;
          await db.meds.put({ ...m, name: m.name.trim() });
          props.onClose();
        }}
      >
        <label>
          Name
          <input required value={m.name} onChange={(e) => set({ name: e.target.value })} aria-label="Name" placeholder="e.g. Vitamin D, iron" />
        </label>
        <label>
          Dose
          <input value={m.dose} onChange={(e) => set({ dose: e.target.value })} aria-label="Dose" placeholder="e.g. 1000 IU" />
        </label>
        <div className="seg wide" role="group" aria-label="Type">
          {(['supplement', 'medication'] as const).map((k) => (
            <button type="button" key={k} className={m.kind === k ? 'on' : ''} onClick={() => set({ kind: k })}>
              {k === 'supplement' ? 'Supplement' : 'Medication'}
            </button>
          ))}
        </div>
        <div className="seg wide" role="group" aria-label="Schedule">
          <button type="button" className={m.schedule === 'daily' ? 'on' : ''} onClick={() => set({ schedule: 'daily' })}>
            Every day
          </button>
          <button type="button" className={m.schedule === 'as_needed' ? 'on' : ''} onClick={() => set({ schedule: 'as_needed' })}>
            As needed
          </button>
        </div>
        <p className="hint">Daily items appear as a checklist on Today. As-needed items get a button to log a dose.</p>
        <label>
          Notes
          <input value={m.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" />
        </label>
        <p className="hint">Check that medications and supplements are gluten-free with your pharmacist.</p>
        <div className="bottom-actions">
          {!props.isNew && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await db.meds.put({ ...m, archived: !m.archived });
                props.onClose();
              }}
            >
              {m.archived ? 'Restore' : 'Stopped taking it'}
            </button>
          )}
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function MedsPage() {
  const nav = useNavigate();
  const meds = useMeds();
  const [editing, setEditing] = useState<{ med: Med; isNew: boolean } | null>(null);
  const doses = useLiveQuery(() => db.doses.orderBy('at').reverse().limit(60).toArray(), []) ?? [];
  const active = meds.filter((m) => !m.archived);
  const stopped = meds.filter((m) => m.archived);
  const name = (id: string) => meds.find((m) => m.id === id)?.name ?? 'Removed item';

  return (
    <div className="page">
      <Header title="Meds and supplements" back={() => nav(-1)} />
      <button
        type="button"
        className="btn primary"
        onClick={() => setEditing({ med: { id: newId(), name: '', dose: '', kind: 'supplement', schedule: 'daily', archived: false, notes: '' }, isNew: true })}
      >
        + Add
      </button>
      <div className="list">
        {active.map((m) => (
          <div className="row" key={m.id}>
            <button type="button" className="plain grow left" onClick={() => setEditing({ med: m, isNew: false })}>
              <span className="title">{m.name}</span>
              {m.dose && <span className="sub"> · {m.dose}</span>}
              <span className="sub block">
                {m.kind === 'supplement' ? 'Supplement' : 'Medication'} · {m.schedule === 'daily' ? 'every day' : 'as needed'}
              </span>
            </button>
            {m.schedule === 'as_needed' && (
              <button type="button" className="small" onClick={() => void db.doses.put({ id: newId(), medId: m.id, at: localTime(), notes: '' })}>
                Took one
              </button>
            )}
          </div>
        ))}
      </div>
      {!active.length && <p className="empty">Nothing added yet.</p>}
      {stopped.length > 0 && (
        <>
          <h3>Stopped</h3>
          <div className="list">
            {stopped.map((m) => (
              <button type="button" className="row clickable" key={m.id} onClick={() => setEditing({ med: m, isNew: false })}>
                <span className="grow sub">{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {doses.length > 0 && (
        <>
          <h3>Recent doses</h3>
          <div className="list">
            {doses.map((d) => (
              <div className="row" key={d.id}>
                <span className="time">{dayOf(d.at) === dateStr() ? fmtTime(d.at) : `${fmtDay(dayOf(d.at))} ${fmtTime(d.at)}`}</span>
                <span className="grow">{name(d.medId)}</span>
                <button type="button" className="tiny" aria-label="Remove dose" onClick={() => void db.doses.delete(d.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {editing && <MedEditor med={editing.med} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}
