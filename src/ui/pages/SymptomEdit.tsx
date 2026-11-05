import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, newId } from '../../db/db';
import { mealRisk } from '../../domain/gluten';
import { mealsBefore } from '../../domain/patterns';
import {
  ABDOMEN_GRID,
  AREA_BLURBS,
  AREA_LABELS,
  BODY_AREAS,
  FREQUENCIES,
  FREQUENCY_LABELS,
  LOCATIONS,
  PAIN_TYPES,
  SIDES,
  areaOf,
  groupOf,
  hasWhere,
  isPain,
  unrated,
  type BodyArea,
  type SymptomLists,
} from '../../domain/symptoms';
import { fmtGap, localTime, ms } from '../../domain/time';
import { WHERE_LABELS, type BowelEntry, type SymptomEntry, type SymptomScore } from '../../domain/types';
import { Chip, Header, NumberInput, RiskTag, Scale, cap, toggle } from '../components/common';
import { useBack, usePlaces, useSettings } from '../data';

/** One symptom's rating and details. */
function SymptomDetail(props: { x: SymptomScore; area: BodyArea; onChange: (p: Partial<SymptomScore>) => void; onRemove: () => void }) {
  const { x, area, onChange } = props;
  const locs = x.locations ?? [];
  const pickLoc = (l: string) => onChange({ locations: toggle(locs, l) });
  return (
    <div className="severity-row">
      <div className="label-row">
        <span className="title">{x.type}</span>
        <span className="sub grow">{x.severity ? `${x.severity}/10` : 'Not rated yet'}</span>
        <button type="button" className="tiny" aria-label={`Remove ${x.type}`} onClick={props.onRemove}>
          ✕ Remove
        </button>
      </div>
      <Scale n={10} tone="severity" clearable={false} value={x.severity || undefined} label={`${x.type} severity`} onChange={(v) => v && onChange({ severity: v })} low="Barely" high="Worst" />

      <span className="label">How often</span>
      <div className="seg wide" role="radiogroup" aria-label={`${x.type} frequency`}>
        {FREQUENCIES.map((f) => (
          <button type="button" role="radio" aria-checked={x.frequency === f} key={f} className={x.frequency === f ? 'on' : ''} onClick={() => onChange({ frequency: x.frequency === f ? undefined : f })}>
            {FREQUENCY_LABELS[f]}
          </button>
        ))}
      </div>

      {hasWhere(x.type) && (
        <>
          <span className="label">Where</span>
          {area === 'abdomen' && (
            <div className="body-grid" role="group" aria-label={`${x.type} location on the abdomen`}>
              {ABDOMEN_GRID.flat().map((l) => (
                <button type="button" key={l} className={locs.includes(l) ? 'on' : ''} aria-pressed={locs.includes(l)} onClick={() => pickLoc(l)}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <div className="chips" role="group" aria-label={`${x.type} location`}>
            {[...LOCATIONS[area], ...SIDES[area], ...locs.filter((l) => ![...LOCATIONS[area], ...SIDES[area], ...ABDOMEN_GRID.flat()].includes(l))].map((l) => (
              <Chip key={l} on={locs.includes(l)} onClick={() => pickLoc(l)}>
                {l}
              </Chip>
            ))}
          </div>
        </>
      )}

      {isPain(x.type) && (
        <>
          <span className="label">Feels like</span>
          <div className="chips" role="group" aria-label={`${x.type} feels like`}>
            {PAIN_TYPES.map((q) => (
              <Chip key={q} on={!!x.qualities?.includes(q)} onClick={() => onChange({ qualities: toggle(x.qualities ?? [], q) })}>
                {q}
              </Chip>
            ))}
          </div>
        </>
      )}

      <label>
        How long did it last? <span className="hint">(hours, optional)</span>
        <NumberInput value={x.durationHours} min={0} onChange={(v) => onChange({ durationHours: v })} label={`${x.type} duration in hours`} />
      </label>
    </div>
  );
}

/** A collapsible body-area section: its symptom chips, a box for others, and the chosen symptoms' details. */
function AreaSection(props: {
  area: BodyArea;
  open: boolean;
  onToggle: () => void;
  offered: string[];
  chosen: SymptomScore[];
  onPick: (type: string) => void;
  onAdd: (type: string) => void;
  onChange: (type: string, p: Partial<SymptomScore>) => void;
  onRemove: (type: string) => void;
}) {
  const { area, chosen } = props;
  const [other, setOther] = useState('');
  const on = (t: string) => chosen.some((x) => x.type === t);
  // Chips under their sub-heading, in list order; ungrouped (custom) ones last.
  const groups = new Map<string, string[]>();
  for (const t of props.offered) {
    const g = groupOf(t) ?? '';
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0));
  const panel = `area-${area}`;

  return (
    <section className={'card accordion' + (props.open ? ' open' : '')}>
      <button type="button" className="accordion-head" aria-expanded={props.open} aria-controls={panel} onClick={props.onToggle}>
        <span className="grow">
          <span className="title">{AREA_LABELS[area]}</span>
          <span className="sub block">{chosen.length ? chosen.map((x) => x.type).join(', ') : AREA_BLURBS[area]}</span>
        </span>
        {chosen.length > 0 && <span className="pill">{chosen.length}</span>}
        <span className="chev" aria-hidden>
          {props.open ? '▾' : '▸'}
        </span>
      </button>
      {props.open && (
        <div id={panel} className="form">
          {ordered.map(([g, list]) => (
            <div key={g || 'other'} className="chip-group">
              {g && ordered.length > 1 && <span className="label">{g}</span>}
              <div className="chips">
                {list.map((t) => (
                  <Chip key={t} on={on(t)} onClick={() => props.onPick(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <form
            className="search-row"
            onSubmit={(e) => {
              e.preventDefault();
              const t = other.trim();
              if (t) props.onAdd(t);
              setOther('');
            }}
          >
            <input placeholder="Something else" value={other} onChange={(e) => setOther(e.target.value)} aria-label={`Other ${AREA_LABELS[area].toLowerCase()} symptom`} />
            <button type="submit" className="small" disabled={!other.trim()}>
              Add
            </button>
          </form>
          {chosen.map((x) => (
            <SymptomDetail key={x.type} x={x} area={area} onChange={(p) => props.onChange(x.type, p)} onRemove={() => props.onRemove(x.type)} />
          ))}
        </div>
      )}
    </section>
  );
}

export function SymptomEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const back = useBack('/symptoms');
  const settings = useSettings();
  const lists: SymptomLists = settings.symptomLists;
  const places = usePlaces();
  const isNew = id === 'new';
  const existing = useLiveQuery(() => (isNew ? undefined : db.symptoms.get(id!)), [id]);
  const [s, setS] = useState<SymptomEntry | null>(null);
  const [open, setOpen] = useState<Set<BodyArea>>(new Set());

  useEffect(() => {
    if (isNew) {
      setS({ id: newId(), at: params.get('at') ?? localTime(), symptoms: [], notes: '' });
      setOpen(new Set(['abdomen']));
    } else if (existing && !s) {
      setS(existing);
      setOpen(new Set(existing.symptoms.map((x) => areaOf(x, lists))));
    }
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
  const areaFor = (x: SymptomScore) => areaOf(x, lists);
  /** Symptoms in area order, then in the order they're offered. */
  const rank = (x: SymptomScore) => {
    const a = areaFor(x);
    const i = lists[a].indexOf(x.type);
    return BODY_AREAS.indexOf(a) * 1000 + (i < 0 ? 999 : i);
  };
  const setSymptoms = (list: SymptomScore[]) => set({ symptoms: [...list].sort((a, b) => rank(a) - rank(b)) });
  const has = (type: string) => s.symptoms.some((x) => x.type === type);
  // New symptoms start unrated (0) so nothing counts as a reaction until you rate it.
  const add = (type: string, area: BodyArea) => !has(type) && setSymptoms([...s.symptoms, { type, severity: 0, area }]);
  const remove = (type: string) => setSymptoms(s.symptoms.filter((x) => x.type !== type));
  const change = (type: string, p: Partial<SymptomScore>) => setSymptoms(s.symptoms.map((x) => (x.type === type ? { ...x, ...p } : x)));
  const missing = unrated(s);

  return (
    <div className="page">
      <Header title={isNew ? 'Log symptoms' : 'Symptoms'} back={back} />
      <section className="card form">
        <label>
          When did they start?
          <input type="datetime-local" value={s.at} onChange={(e) => e.target.value && set({ at: e.target.value })} aria-label="When" />
        </label>
      </section>

      <p className="hint">Open a body area, tap what you feel, then rate it from 1 (barely there) to 10 (the worst). Where, how often and what it feels like are optional.</p>
      {BODY_AREAS.map((area) => {
        const chosen = s.symptoms.filter((x) => areaFor(x) === area);
        const offered = [...lists[area], ...chosen.map((x) => x.type).filter((t) => !lists[area].includes(t))];
        return (
          <AreaSection
            key={area}
            area={area}
            open={open.has(area)}
            onToggle={() => setOpen(new Set(toggle([...open], area)))}
            offered={offered}
            chosen={chosen}
            onPick={(t) => (has(t) ? remove(t) : add(t, area))}
            onAdd={(t) => {
              // Remember it for next time in this area's list.
              if (!BODY_AREAS.some((a) => lists[a].includes(t))) void db.settings.put({ ...settings, symptomLists: { ...lists, [area]: [...lists[area], t] } });
              add(t, area);
            }}
            onChange={change}
            onRemove={remove}
          />
        );
      })}

      <section className="card form">
        {s.durationHours !== undefined && (
          <label>
            How long did it all last? <span className="hint">(hours)</span>
            <NumberInput value={s.durationHours} min={0} onChange={(v) => set({ durationHours: v })} label="Duration in hours" />
          </label>
        )}
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

      {missing.length > 0 && <p className="hint center">Rate {missing.map((x) => x.type).join(', ')} to save.</p>}
      <div className="bottom-actions">
        {!isNew && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm('Delete this entry?')) return;
              await db.symptoms.delete(s.id);
              back();
            }}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          className="btn primary"
          disabled={!s.symptoms.length || missing.length > 0}
          onClick={async () => {
            await db.symptoms.put(s);
            back();
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
  const back = useBack('/symptoms');
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
      <Header title="Bowel movement" back={back} />
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
              back();
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
            back();
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
