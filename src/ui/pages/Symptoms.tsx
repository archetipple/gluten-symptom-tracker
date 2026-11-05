import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { maxSeverity } from '../../domain/patterns';
import { describe } from '../../domain/symptoms';
import { addDays, dateStr, dayOf, fmtDay, fmtDuration, fmtTime } from '../../domain/time';
import type { BowelEntry, SymptomEntry } from '../../domain/types';
import { Header, SeverityTag } from '../components/common';
import { useSettings } from '../data';
import { BRISTOL } from './SymptomEdit';

type Entry = { kind: 'symptom'; at: string; s: SymptomEntry } | { kind: 'bowel'; at: string; b: BowelEntry };

export function SymptomRow(props: { s: SymptomEntry }) {
  const nav = useNavigate();
  const { s } = props;
  return (
    <button type="button" className="row clickable" onClick={() => nav(`/symptom/${s.id}`)}>
      <span className="time">{fmtTime(s.at)}</span>
      <span className="grow">
        <span className="title">{s.symptoms.map((x) => x.type).join(', ')}</span>
        {s.durationHours !== undefined && <span className="sub"> · {fmtDuration(s.durationHours)}</span>}
        {s.symptoms.map((x) => {
          const d = describe(x);
          return (
            d && (
              <span key={x.type} className="sub block">
                {x.type}: {d}
              </span>
            )
          );
        })}
        {s.notes && <span className="sub block">{s.notes}</span>}
      </span>
      <SeverityTag severity={maxSeverity(s)} />
    </button>
  );
}

export function BowelRow(props: { b: BowelEntry }) {
  const nav = useNavigate();
  const { b } = props;
  const tone = b.blood ? 'gluten' : b.bristol >= 6 || b.bristol <= 2 ? 'risk' : 'safe';
  return (
    <button type="button" className="row clickable" onClick={() => nav(`/bowel/${b.id}`)}>
      <span className="time">{fmtTime(b.at)}</span>
      <span className="grow">
        <span className="title">Bowel movement</span>
        <span className="sub">
          {' '}
          · {BRISTOL[b.bristol - 1]?.[1] ?? 'Type not recorded'}
          {b.urgent ? ' · urgent' : ''}
          {b.blood ? ' · blood' : ''}
        </span>
      </span>
      <span className={`tag ${tone}`}>Type {b.bristol}</span>
    </button>
  );
}

export function SymptomsPage() {
  const settings = useSettings();
  const [days, setDays] = useState(14);
  const since = addDays(dateStr(), -days + 1);
  const entries =
    useLiveQuery(async () => {
      const [s, b] = await Promise.all([db.symptoms.where('at').aboveOrEqual(since).toArray(), db.bowel.where('at').aboveOrEqual(since).toArray()]);
      const all: Entry[] = [...s.map((x) => ({ kind: 'symptom' as const, at: x.at, s: x })), ...b.map((x) => ({ kind: 'bowel' as const, at: x.at, b: x }))];
      return all.sort((a, c) => (a.at < c.at ? 1 : -1));
    }, [since]) ?? [];
  // Is there anything before the shown range? Hides "Show older" when not.
  const older = useLiveQuery(async () => (await db.symptoms.where('at').below(since).count()) + (await db.bowel.where('at').below(since).count()), [since]) ?? 0;
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const d = dayOf(e.at);
    const list = byDay.get(d);
    if (list) list.push(e);
    else byDay.set(d, [e]);
  }

  return (
    <div className="page">
      <Header title="Symptoms" />
      <div className="bottom-actions">
        <Link className="btn primary" to="/symptom/new">
          + Symptoms
        </Link>
        {settings.trackBowel && (
          <Link className="btn" to="/bowel/new">
            + Digestion
          </Link>
        )}
      </div>
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day}>
          <h3>{fmtDay(day)}</h3>
          <div className="list">{list.map((e) => (e.kind === 'symptom' ? <SymptomRow key={e.s.id} s={e.s} /> : <BowelRow key={e.b.id} b={e.b} />))}</div>
        </section>
      ))}
      {!entries.length && (
        <p className="empty">
          {older ? `Nothing logged in the last ${days} days.` : 'Nothing logged yet.'} Keep logging meals on good days too: Patterns compares them with the days that had symptoms.
        </p>
      )}
      {older > 0 && (
        <button type="button" className="btn" onClick={() => setDays(days + 30)}>
          Show older
        </button>
      )}
    </div>
  );
}
