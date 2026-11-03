import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, newId } from '../../db/db';
import { mealRisk } from '../../domain/gluten';
import { localTime } from '../../domain/time';
import { CONCERNS, MEAL_KINDS, WHERE, WHERE_LABELS, type Meal, type MealKind } from '../../domain/types';
import { FoodFinder } from '../components/FoodFinder';
import { Chip, GlutenTag, Header, Modal, RiskTag, cap, toggle } from '../components/common';
import { usePlaces } from '../data';

export function kindForHour(h: number): MealKind {
  if (h < 10) return 'breakfast';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 17 && h < 21) return 'dinner';
  return 'snack';
}

function blankMeal(at: string): Meal {
  return { id: newId(), at, kind: kindForHour(Number(at.slice(11, 13))), items: [], where: 'home', concerns: [], notes: '' };
}

export function MealEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const places = usePlaces();
  const isNew = id === 'new';
  const existing = useLiveQuery(() => (isNew ? undefined : db.meals.get(id!)), [id]);
  const [m, setM] = useState<Meal | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isNew) {
      const copyOf = params.get('copy');
      if (copyOf) void db.meals.get(copyOf).then((c) => setM(c ? { ...c, id: newId(), at: localTime() } : blankMeal(localTime())));
      else setM(blankMeal(params.get('at') ?? localTime()));
    } else if (existing && !m) setM(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, isNew]);

  if (!m) return <div className="page" />;
  const set = (p: Partial<Meal>) => setM({ ...m, ...p });
  const place = places.find((p) => p.id === m.placeId);
  const verdict = mealRisk(m, place);

  return (
    <div className="page">
      <Header title={isNew ? 'Log food' : 'Meal'} back={() => nav(-1)} />

      <section className="card form">
        <div className="seg wide" role="group" aria-label="Meal">
          {MEAL_KINDS.map((k) => (
            <button type="button" key={k} className={m.kind === k ? 'on' : ''} onClick={() => set({ kind: k })}>
              {cap(k)}
            </button>
          ))}
        </div>
        <label>
          When
          <input type="datetime-local" value={m.at} onChange={(e) => e.target.value && set({ at: e.target.value })} aria-label="When" />
        </label>
      </section>

      <section className="card form">
        <h2>What you ate</h2>
        {m.items.length === 0 && <p className="hint">Add each food or drink. Scanning the barcode checks it for gluten.</p>}
        <ul className="items">
          {m.items.map((it, i) => (
            <li key={i} className="item">
              <div className="label-row">
                <span className="title grow">{it.name}</span>
                <GlutenTag status={it.gluten} short />
                <button type="button" className="tiny" aria-label={`Remove ${it.name}`} onClick={() => set({ items: m.items.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </div>
              <input
                className="amount-input"
                placeholder="Amount (optional), e.g. 2 slices"
                value={it.amount ?? ''}
                onChange={(e) => set({ items: m.items.map((x, j) => (j === i ? { ...x, amount: e.target.value || undefined } : x)) })}
                aria-label={`Amount of ${it.name}`}
              />
            </li>
          ))}
        </ul>
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          + Add food or drink
        </button>
      </section>

      <section className="card form">
        <h2>Where</h2>
        <select value={m.where} onChange={(e) => set({ where: e.target.value as Meal['where'], placeId: e.target.value === 'home' ? undefined : m.placeId })} aria-label="Where">
          {WHERE.map((w) => (
            <option key={w} value={w}>
              {WHERE_LABELS[w]}
            </option>
          ))}
        </select>
        {m.where !== 'home' && (
          <label>
            Place
            <select value={m.placeId ?? ''} onChange={(e) => set({ placeId: e.target.value || undefined })} aria-label="Place">
              <option value="">Not saved / other</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.safety ? ` (${p.safety}/5)` : ''}
                </option>
              ))}
            </select>
            <span className="hint">Add places in the Places tab to rate how safe they are.</span>
          </label>
        )}
        <span className="label">Any cross-contact worries?</span>
        <div className="chips">
          {CONCERNS.map((c) => (
            <Chip key={c} on={m.concerns.includes(c)} onClick={() => set({ concerns: toggle(m.concerns, c) })}>
              {c}
            </Chip>
          ))}
        </div>
        <label>
          Notes
          <textarea rows={2} value={m.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" />
        </label>
      </section>

      <section className="card">
        <div className="label-row">
          <span className="label">Gluten risk</span>
          <RiskTag risk={verdict.risk} />
        </div>
        {verdict.reasons.length > 0 && (
          <ul className="reasons">
            {verdict.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="bottom-actions">
        {!isNew && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm('Delete this meal?')) return;
              await db.meals.delete(m.id);
              nav(-1);
            }}
          >
            Delete
          </button>
        )}
        {!isNew && (
          <button type="button" className="btn" onClick={() => nav(`/meal/new?copy=${m.id}`, { replace: true })}>
            Eat again now
          </button>
        )}
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            await db.meals.put(m);
            nav(-1);
          }}
        >
          Save
        </button>
      </div>

      {adding && (
        <Modal title="Add food" onClose={() => setAdding(false)}>
          <FoodFinder
            onPick={(f) => {
              set({ items: [...m.items, { foodId: f.id, name: f.brand ? `${f.name} (${f.brand})` : f.name, gluten: f.gluten }] });
              setAdding(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
