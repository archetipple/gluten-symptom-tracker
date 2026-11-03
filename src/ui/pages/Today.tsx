import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db, newId } from '../../db/db';
import { addDays, dateStr, dayOf, fmtDay, localTime } from '../../domain/time';
import { FLOW, type DayFactors, type Flow } from '../../domain/types';
import { Header, NumberInput, Scale, cap } from '../components/common';
import { useMeds, usePlaces, useSettings } from '../data';
import { MealRow } from './FoodLog';
import { BowelRow, SymptomRow } from './Symptoms';

function CheckIn(props: { date: string; trackPeriod: boolean }) {
  const day = useLiveQuery(() => db.days.get(props.date), [props.date]);
  const d: DayFactors = day ?? { date: props.date, notes: '' };
  const save = (p: Partial<DayFactors>) => void db.days.put({ ...d, ...p });
  const [notes, setNotes] = useState<string | null>(null);

  return (
    <section className="card form">
      <h2>Daily check-in</h2>
      <div className="grid2">
        <label>
          Sleep (hours)
          <NumberInput value={d.sleepHours} min={0} max={24} label="Hours slept" onChange={(v) => save({ sleepHours: v })} />
        </label>
        <div />
      </div>
      <span className="label">Sleep quality</span>
      <Scale n={5} value={d.sleepQuality} label="Sleep quality" onChange={(v) => save({ sleepQuality: v })} low="Poor" high="Great" />
      <span className="label">Stress</span>
      <Scale n={5} value={d.stress} label="Stress" onChange={(v) => save({ stress: v })} low="Calm" high="Very stressed" />
      {props.trackPeriod && (
        <>
          <span className="label">Period</span>
          <div className="seg wide" role="group" aria-label="Period">
            {FLOW.map((f: Flow) => (
              <button type="button" key={f} className={d.period === f ? 'on' : ''} onClick={() => save({ period: d.period === f ? undefined : f })}>
                {cap(f)}
              </button>
            ))}
          </div>
        </>
      )}
      <label>
        Notes
        <input
          value={notes ?? d.notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== null && (save({ notes }), setNotes(null))}
          aria-label="Day notes"
          placeholder="Anything unusual today?"
        />
      </label>
    </section>
  );
}

function MedsCard(props: { date: string }) {
  const meds = useMeds().filter((m) => !m.archived);
  const doses = useLiveQuery(() => db.doses.where('at').between(`${props.date}T00:00`, `${props.date}T23:59`, true, true).toArray(), [props.date]) ?? [];
  if (!meds.length)
    return (
      <Link className="btn" to="/meds">
        + Add meds or supplements
      </Link>
    );
  const daily = meds.filter((m) => m.schedule === 'daily');
  const asNeeded = meds.filter((m) => m.schedule === 'as_needed');
  const at = props.date === dateStr() ? localTime() : `${props.date}T12:00`;
  return (
    <section className="card">
      <div className="label-row">
        <h2>Meds and supplements</h2>
        <Link className="small" to="/meds">
          Edit
        </Link>
      </div>
      {daily.map((m) => {
        const taken = doses.find((d) => d.medId === m.id);
        return (
          <label className="inline check" key={m.id}>
            <input
              type="checkbox"
              checked={!!taken}
              onChange={() => void (taken ? db.doses.delete(taken.id) : db.doses.put({ id: newId(), medId: m.id, at, notes: '' }))}
            />
            {m.name}
            {m.dose && <span className="sub">{m.dose}</span>}
          </label>
        );
      })}
      {asNeeded.length > 0 && (
        <div className="chips">
          {asNeeded.map((m) => {
            const n = doses.filter((d) => d.medId === m.id).length;
            return (
              <button type="button" className="chip" key={m.id} onClick={() => void db.doses.put({ id: newId(), medId: m.id, at, notes: '' })}>
                + {m.name}
                {n > 0 && ` (${n} today)`}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function Today() {
  const settings = useSettings();
  const places = usePlaces();
  const [date, setDate] = useState(dateStr());
  const isToday = date === dateStr();
  const range = [`${date}T00:00`, `${date}T23:59`] as const;
  const entries = useLiveQuery(async () => {
    const [meals, symptoms, bowel] = await Promise.all([
      db.meals.where('at').between(...range, true, true).toArray(),
      db.symptoms.where('at').between(...range, true, true).toArray(),
      db.bowel.where('at').between(...range, true, true).toArray(),
    ]);
    return [
      ...meals.map((m) => ({ at: m.at, el: <MealRow key={m.id} meal={m} places={places} /> })),
      ...symptoms.map((s) => ({ at: s.at, el: <SymptomRow key={s.id} s={s} /> })),
      ...bowel.map((b) => ({ at: b.at, el: <BowelRow key={b.id} b={b} /> })),
    ].sort((a, b) => (a.at < b.at ? -1 : 1));
  }, [date, places]);
  const at = isToday ? '' : `?at=${date}T12:00`;

  return (
    <div className="page">
      <Header
        title={isToday ? 'Today' : fmtDay(date)}
        right={
          <Link to="/settings" className="ghost gear" aria-label="Settings">
            ⚙
          </Link>
        }
      />
      <div className="date-nav">
        <button type="button" className="ghost" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <span className="sub">{new Date(`${date}T12:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        <button type="button" className="ghost" aria-label="Next day" disabled={isToday} onClick={() => setDate(addDays(date, 1))}>
          ›
        </button>
      </div>

      <div className="quick">
        <Link className="btn primary" to={`/meal/new${at}`}>
          + Food
        </Link>
        <Link className="btn primary" to={`/symptom/new${at}`}>
          + Symptoms
        </Link>
        {settings.trackBowel && (
          <Link className="btn" to={`/bowel/new${at}`}>
            + Bowel
          </Link>
        )}
      </div>

      <section>
        <h3>{isToday ? "Today's log" : 'Log'}</h3>
        <div className="list">{entries?.map((e) => e.el)}</div>
        {entries && !entries.length && <p className="empty">Nothing logged{isToday ? ' yet today' : ''}.</p>}
      </section>

      <CheckIn date={date} trackPeriod={settings.trackPeriod} />
      <MedsCard date={date} />
      {dayOf(localTime()) === date && <p className="hint center">Log meals even on good days. Patterns needs them to compare.</p>}
    </div>
  );
}
