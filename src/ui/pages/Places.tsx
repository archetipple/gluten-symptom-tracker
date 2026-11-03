import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, newId } from '../../db/db';
import { followedByReaction, reactionsOf, settledMeals } from '../../domain/patterns';
import { PLACE_KINDS, type Place } from '../../domain/types';
import { Chip, Header, Scale, Star, cap } from '../components/common';
import { MealRow } from './FoodLog';
import { usePlaces, useSettings } from '../data';

const SAFETY = ['', 'Avoid', 'Risky', 'Okay with care', 'Good', 'Very safe'];

function features(p: Place): string[] {
  return [p.dedicatedGf && 'Fully gluten-free', p.gfMenu && 'GF menu', p.dedicatedFryer && 'Dedicated fryer', p.separatePrep && 'Separate prep'].filter(Boolean) as string[];
}

export function PlacesPage() {
  const nav = useNavigate();
  const places = usePlaces();
  const [q, setQ] = useState('');
  const [safeOnly, setSafeOnly] = useState(false);
  const term = q.trim().toLowerCase();
  const shown = places
    .filter((p) => !term || `${p.name} ${p.area}`.toLowerCase().includes(term))
    .filter((p) => !safeOnly || (p.safety ?? 0) >= 4 || p.dedicatedGf)
    .sort((a, b) => Number(b.favourite) - Number(a.favourite) || (b.safety ?? 0) - (a.safety ?? 0));

  return (
    <div className="page">
      <Header title="Places" />
      <p className="hint">Rate places by how safe you felt eating there. Meals logged at a place you rate 4 or 5 count as lower risk.</p>
      <Link className="btn primary" to="/places/new">
        + Add a place
      </Link>
      <div className="search-row">
        <input type="search" placeholder="Search places" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search places" />
        <Chip on={safeOnly} onClick={() => setSafeOnly(!safeOnly)}>
          Safe only
        </Chip>
      </div>
      <div className="list">
        {shown.map((p) => (
          <div className="row" key={p.id}>
            <Star on={p.favourite} onClick={() => void db.places.update(p.id, { favourite: !p.favourite })} />
            <button type="button" className="plain grow left" onClick={() => nav(`/places/${p.id}`)}>
              <span className="title">{p.name}</span>
              <span className="sub">
                {' '}
                · {cap(p.kind)}
                {p.area && ` · ${p.area}`}
              </span>
              {features(p).length > 0 && <span className="sub block">{features(p).join(' · ')}</span>}
            </button>
            {p.safety ? <span className={`tag ${p.safety >= 4 ? 'safe' : p.safety <= 2 ? 'gluten' : 'unsure'}`}>{p.safety}/5</span> : <span className="tag unsure">Not rated</span>}
          </div>
        ))}
      </div>
      {!shown.length && <p className="empty">{places.length ? 'No places match.' : 'No places yet.'}</p>}
    </div>
  );
}

export function PlaceEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const isNew = id === 'new';
  const existing = useLiveQuery(() => (isNew ? undefined : db.places.get(id!)), [id]);
  const [p, setP] = useState<Place | null>(null);
  const places = usePlaces();
  const history = useLiveQuery(async () => {
    if (isNew) return null;
    const meals = (await db.meals.toArray()).filter((m) => m.placeId === id).sort((a, b) => (a.at < b.at ? 1 : -1));
    const reactions = reactionsOf(await db.symptoms.toArray(), settings.reactionSeverity);
    const settled = settledMeals(meals, settings.windowHours);
    return { meals, settled: settled.length, followed: settled.filter((m) => followedByReaction(m, reactions, settings.windowHours)).length };
  }, [id, settings.reactionSeverity, settings.windowHours]);

  useEffect(() => {
    if (isNew) setP({ id: newId(), name: '', kind: 'restaurant', area: '', gfMenu: false, dedicatedFryer: false, separatePrep: false, dedicatedGf: false, favourite: false, notes: '' });
    else if (existing && !p) setP(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, isNew]);
  if (!p) return <div className="page" />;
  const set = (x: Partial<Place>) => setP({ ...p, ...x });

  return (
    <div className="page">
      <Header title={isNew ? 'New place' : p.name || 'Place'} back={() => nav(-1)} />
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!p.name.trim()) return;
          await db.places.put({ ...p, name: p.name.trim(), area: p.area.trim() });
          nav(-1);
        }}
      >
        <section className="card form">
          <label>
            Name
            <input required value={p.name} onChange={(e) => set({ name: e.target.value })} aria-label="Name" />
          </label>
          <div className="grid2">
            <label>
              Kind
              <select value={p.kind} onChange={(e) => set({ kind: e.target.value as Place['kind'] })} aria-label="Kind">
                {PLACE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {cap(k)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Area or address
              <input value={p.area} onChange={(e) => set({ area: e.target.value })} aria-label="Area or address" />
            </label>
          </div>
        </section>
        <section className="card form">
          <span className="label">How safe do you feel eating here? {p.safety ? `(${SAFETY[p.safety]})` : ''}</span>
          <Scale n={5} value={p.safety} label="Safety rating" onChange={(v) => set({ safety: v })} low="Avoid" high="Very safe" />
          <div className="chips">
            <Chip on={p.dedicatedGf} onClick={() => set({ dedicatedGf: !p.dedicatedGf })}>
              Fully gluten-free kitchen
            </Chip>
            <Chip on={p.gfMenu} onClick={() => set({ gfMenu: !p.gfMenu })}>
              Gluten-free menu
            </Chip>
            <Chip on={p.dedicatedFryer} onClick={() => set({ dedicatedFryer: !p.dedicatedFryer })}>
              Dedicated fryer
            </Chip>
            <Chip on={p.separatePrep} onClick={() => set({ separatePrep: !p.separatePrep })}>
              Separate prep area
            </Chip>
          </div>
          <label>
            Notes
            <textarea rows={3} value={p.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" placeholder="What to order, who to ask, what to avoid" />
          </label>
        </section>
        <div className="bottom-actions">
          {!isNew && (
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                if (!confirm(`Delete ${p.name}? Meals logged there keep their entries.`)) return;
                await db.places.delete(p.id);
                nav(-1);
              }}
            >
              Delete
            </button>
          )}
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>

      {history && history.meals.length > 0 && (
        <section>
          <h3>Meals here</h3>
          {history.settled > 0 && (
            <p className="hint">
              {history.followed} of {history.settled} were followed by symptoms of {settings.reactionSeverity}/10 or more within {settings.windowHours} hours.
            </p>
          )}
          <div className="list">
            {history.meals.slice(0, 20).map((m) => (
              <MealRow key={m.id} meal={m} places={places} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
