import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, newId } from '../../db/db';
import { mealRisk } from '../../domain/gluten';
import { mealsBefore } from '../../domain/patterns';
import { fmtGap, localTime, ms } from '../../domain/time';
import { WHERE_LABELS, type BowelEntry, type SymptomEntry } from '../../domain/types';
import { Chip, Header, NumberInput, RiskTag, Scale, cap } from '../components/common';
import { usePlaces, useSettings } from '../data';

export function SymptomEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const settings = useSettings();
  const places = usePlaces();
  const isNew = id === 'new';
  const existing = useLiveQuery(() => (isNew ? undefined : db.symptoms.get(id!)), [id]);
  const [s, setS] = useState<SymptomEntry | null>(null);
  const [other, setOther] = useState('');

  useEffect(() => {
    if (isNew) setS({ id: newId(), at: params.get('at') ?? localTime(), symptoms: [], notes: '' });
    else if (existing && !s) setS(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, isNew]);

  const hours = settings.windowHours;
  const at = s?.at;
  const recent =
    useLiveQuery(async () => {
      if (!at) return [];
      const from = new Date(ms(at) - hours * 3600000);
      const fromStr = localTime(from);
      return mealsBefore(at, await db.meals.where('at').between(fromStr, at, true, true).toArray(), hours);
    }, [at, hours]) ?? [];

  if (!s) return <div className="page" />;
  const set = (p: Partial<SymptomEntry>) => setS({ ...s, ...p });
  const types = [...settings.symptomTypes, ...s.symptoms.map((x) => x.type).filter((t) => !settings.symptomTypes.includes(t))];
  const score = (type: string) => s.symptoms.find((x) => x.type === type);
  const setScore = (type: string, severity: number | undefined) => {
    const rest = s.symptoms.filter((x) => x.type !== type);
    set({ symptoms: severity === undefined ? rest : [...rest, { type, severity }].sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type)) });
  };

  return (
    <div className="page">
      <Header title={isNew ? 'Log symptoms' : 'Symptoms'} back={() => nav(-1)} />
      <section className="card form">
        <label>
          When did they start?
          <input type="datetime-local" value={s.at} onChange={(e) => e.target.value && set({ at: e.target.value })} aria-label="When" />
        </label>
      </section>

      <section className="card form">
        <h2>What do you feel?</h2>
        <p className="hint">Tap a symptom, then rate it from 1 (barely there) to 10 (the worst).</p>
        <div className="chips">
          {types.map((t) => (
            <Chip key={t} on={!!score(t)} onClick={() => setScore(t, score(t) ? undefined : 5)}>
              {t}
            </Chip>
          ))}
        </div>
        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (other.trim() && !score(other.trim())) setScore(other.trim(), 5);
            setOther('');
          }}
        >
          <input placeholder="Something else" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Other symptom" />
          <button type="submit" className="small" disabled={!other.trim()}>
            Add
          </button>
        </form>
        {s.symptoms.map((x) => (
          <div key={x.type} className="severity-row">
            <div className="label-row">
              <span className="title">{x.type}</span>
              <span className="sub">{x.severity}/10</span>
            </div>
            <Scale n={10} tone="severity" value={x.severity} label={`${x.type} severity`} onChange={(v) => setScore(x.type, v)} low="Barely" high="Worst" />
          </div>
        ))}
      </section>

      <section className="card form">
        <label>
          How long did it last? <span className="hint">(hours, optional)</span>
          <NumberInput value={s.durationHours} min={0} onChange={(v) => set({ durationHours: v })} label="Duration in hours" />
        </label>
        <label>
          Notes
          <textarea rows={2} value={s.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" />
        </label>
      </section>

      <section className="card">
        <h2>Eaten in the {hours} hours before</h2>
        {recent.length === 0 && <p className="hint">No meals logged in that time.</p>}
        <div className="list">
          {recent.map(({ meal, hoursBefore }) => {
            const place = places.find((p) => p.id === meal.placeId);
            return (
              <button type="button" className="row clickable" key={meal.id} onClick={() => nav(`/meal/${meal.id}`)}>
                <span className="grow">
                  <span className="title">{cap(meal.kind)}</span>
                  <span className="sub"> · {fmtGap(hoursBefore)}</span>
                  {meal.where !== 'home' && <span className="sub"> · {place?.name ?? WHERE_LABELS[meal.where]}</span>}
                  <span className="sub block">{meal.items.map((i) => i.name).join(', ') || 'No foods listed'}</span>
                </span>
                <RiskTag risk={mealRisk(meal, place).risk} />
              </button>
            );
          })}
        </div>
      </section>

      <div className="bottom-actions">
        {!isNew && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm('Delete this entry?')) return;
              await db.symptoms.delete(s.id);
              nav(-1);
            }}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className="btn primary"
          disabled={!s.symptoms.length}
          onClick={async () => {
            await db.symptoms.put(s);
            nav(-1);
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export const BRISTOL: [string, string][] = [
  ['Separate hard lumps', 'Severe constipation'],
  ['Lumpy, sausage-shaped', 'Mild constipation'],
  ['Sausage with cracks', 'Normal'],
  ['Smooth, soft sausage', 'Normal'],
  ['Soft blobs, clear edges', 'Lacking fibre'],
  ['Mushy, ragged edges', 'Mild diarrhea'],
  ['Watery, no solid pieces', 'Severe diarrhea'],
];

export function BowelEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const isNew = id === 'new';
  const existing = useLiveQuery(() => (isNew ? undefined : db.bowel.get(id!)), [id]);
  const [b, setB] = useState<BowelEntry | null>(null);
  useEffect(() => {
    if (isNew) setB({ id: newId(), at: params.get('at') ?? localTime(), bristol: 4, urgent: false, blood: false, notes: '' });
    else if (existing && !b) setB(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, isNew]);
  if (!b) return <div className="page" />;
  const set = (p: Partial<BowelEntry>) => setB({ ...b, ...p });

  return (
    <div className="page">
      <Header title="Bowel movement" back={() => nav(-1)} />
      <section className="card form">
        <label>
          When
          <input type="datetime-local" value={b.at} onChange={(e) => e.target.value && set({ at: e.target.value })} aria-label="When" />
        </label>
        <span className="label">Type (Bristol stool scale)</span>
        <div className="bristol" role="radiogroup" aria-label="Bristol type">
          {BRISTOL.map(([look, meaning], i) => (
            <button type="button" role="radio" aria-checked={b.bristol === i + 1} key={i} className={b.bristol === i + 1 ? 'on' : ''} onClick={() => set({ bristol: i + 1 })}>
              <strong>{i + 1}</strong>
              <span>
                {look}
                <span className="sub block">{meaning}</span>
              </span>
            </button>
          ))}
        </div>
        <label className="inline">
          <input type="checkbox" checked={b.urgent} onChange={(e) => set({ urgent: e.target.checked })} /> Urgent
        </label>
        <label className="inline">
          <input type="checkbox" checked={b.blood} onChange={(e) => set({ blood: e.target.checked })} /> Blood, or black and tarry
        </label>
        {b.blood && <p className="warn">Blood or black stool is worth telling your doctor about soon.</p>}
        <label>
          Notes
          <input value={b.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" />
        </label>
      </section>
      <div className="bottom-actions">
        {!isNew && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm('Delete this entry?')) return;
              await db.bowel.delete(b.id);
              nav(-1);
            }}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            await db.bowel.put(b);
            nav(-1);
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
