import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { RISK_LABELS, type MealRisk } from '../../domain/gluten';
import { baseline, byFactor, byKey, byRisk, dailySeries, foodKeys, placeKeys, reactionsOf, symptomCounts, type DayPoint, type Row } from '../../domain/patterns';
import { addDays, dateStr, daysBetween } from '../../domain/time';
import { Header, RiskTag } from '../components/common';
import { useSettings } from '../data';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const RANGES = [30, 90, 365];

/** Daily worst symptom as bars, with the riskiest meal of the day as a dot underneath. */
function DayChart(props: { points: DayPoint[] }) {
  const n = props.points.length;
  const W = 600;
  const H = 150;
  const top = 8;
  const base = 112;
  const bw = W / n;
  const y = (v: number) => base - (v / 10) * (base - top);
  const label = (i: number) => new Date(`${props.points[i].date}T12:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const ticks = [0, Math.floor(n / 2), n - 1];
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Worst symptom per day, with meal risk">
        {[0, 4, 7, 10].map((v) => (
          <g key={v}>
            <line x1={0} x2={W} y1={y(v)} y2={y(v)} className="grid" />
            <text x={2} y={y(v) - 2} className="axis">
              {v}
            </text>
          </g>
        ))}
        {props.points.map((p, i) =>
          p.severity > 0 ? (
            <rect key={p.date} x={i * bw + bw * 0.15} y={y(p.severity)} width={Math.max(1, bw * 0.7)} height={base - y(p.severity)} className={p.severity >= 7 ? 'sev high' : p.severity >= 4 ? 'sev mid' : 'sev low'}>
              <title>
                {p.date}: worst symptom {p.severity}/10
              </title>
            </rect>
          ) : null,
        )}
        {props.points.map((p, i) =>
          p.risk ? (
            <circle key={'r' + p.date} cx={i * bw + bw / 2} cy={base + 10} r={Math.min(4, Math.max(1.6, bw * 0.35))} className={`risk ${p.risk}`}>
              <title>
                {p.date}: {RISK_LABELS[p.risk]}
              </title>
            </circle>
          ) : null,
        )}
        {ticks.map((i) => (
          <text key={i} x={Math.min(W - 40, Math.max(0, i * bw))} y={H - 4} className="axis">
            {label(i)}
          </text>
        ))}
      </svg>
      <figcaption className="zonekey">
        <span>
          <i className="sev mid" /> Worst symptom that day
        </span>
        {(['low', 'unsure', 'possible', 'gluten'] as MealRisk[]).map((r) => (
          <span key={r}>
            <i className={`dot risk ${r}`} /> {RISK_LABELS[r]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function RateTable(props: { rows: Row[]; base: number; label: string; render?: (r: Row) => React.ReactNode }) {
  return (
    <table className="history">
      <thead>
        <tr>
          <th>{props.label}</th>
          <th className="num">Meals</th>
          <th className="num">Then symptoms</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((r) => {
          const flag = r.followed >= 2 && r.rate >= props.base + 0.2;
          return (
            <tr key={r.key} className={flag ? 'flag' : ''}>
              <td>
                {props.render ? props.render(r) : r.label}
                {flag && <span className="flag-note">Worth a closer look</span>}
              </td>
              <td className="num">{r.meals}</td>
              <td className="num">
                {r.followed} ({pct(r.rate)})
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PatternsPage() {
  const settings = useSettings();
  const [range, setRange] = useState(90);
  const to = dateStr();
  const from = addDays(to, -range + 1);
  const data = useLiveQuery(async () => {
    const [meals, symptoms, places, days] = await Promise.all([
      db.meals.where('at').aboveOrEqual(from).toArray(),
      db.symptoms.where('at').aboveOrEqual(from).toArray(),
      db.places.toArray(),
      db.days.where('date').aboveOrEqual(from).toArray(),
    ]);
    return { meals, symptoms, places, days };
  }, [from]);

  if (!data) return <div className="page" />;
  const { meals, symptoms, places, days } = data;
  const input = { meals, symptoms, places, windowHours: settings.windowHours, threshold: settings.reactionSeverity };
  const base = baseline(input);
  const reactions = reactionsOf(symptoms, settings.reactionSeverity);
  const series = dailySeries(daysBetween(addDays(to, -Math.min(range, 90) + 1), to), meals, symptoms, places);
  const risks = byRisk(input);
  const foods = byKey(input, foodKeys).slice(0, 15);
  const placeRows = byKey(input, placeKeys(places), 2);
  const factors = byFactor(days, symptoms, settings.reactionSeverity, settings.trackPeriod).filter((f) => f.withDays > 0 && f.otherDays > 0);
  const counts = symptomCounts(symptoms).slice(0, 8);
  const reactionText = `symptoms of ${settings.reactionSeverity}/10 or more within ${settings.windowHours} hours`;

  return (
    <div className="page">
      <Header title="Patterns" />
      <div className="seg wide" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button type="button" key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
            {r === 365 ? 'Year' : `${r} days`}
          </button>
        ))}
      </div>
      <span className="label">Hours of food to look back from each symptom</span>
      <div className="seg wide" role="group" aria-label="Hours to look back">
        {[12, 24, 48, 72].map((h) => (
          <button type="button" key={h} className={settings.windowHours === h ? 'on' : ''} onClick={() => void db.settings.update('settings', { windowHours: h })}>
            {h} h
          </button>
        ))}
      </div>

      {meals.length < 10 ? (
        <section className="card">
          <h2>Not enough data yet</h2>
          <p>
            Patterns needs a couple of weeks of meals and symptoms. You have {meals.length} meal{meals.length === 1 ? '' : 's'} and {symptoms.length} symptom entr{symptoms.length === 1 ? 'y' : 'ies'} in this
            range.
          </p>
        </section>
      ) : (
        <>
          <section className="card stats">
            <div>
              <div className="big">{reactions.length}</div>
              <div className="sub">times with symptoms {settings.reactionSeverity}/10+</div>
            </div>
            <div>
              <div className="big">{pct(base.rate)}</div>
              <div className="sub">of meals followed by symptoms (the usual rate)</div>
            </div>
          </section>

          {series.length > 0 && <DayChart points={series} />}

          <section>
            <h3>By gluten risk</h3>
            <p className="hint">Share of meals followed by {reactionText}. If risky meals sit well above low-risk ones, hidden gluten is a likely cause.</p>
            <RateTable rows={risks} base={base.rate} label="Meal risk" render={(r) => <RiskTag risk={r.key as MealRisk} />} />
          </section>

          <section>
            <h3>Foods</h3>
            <p className="hint">Foods eaten at least 3 times, most often followed by symptoms first. Highlighted rows are well above your usual {pct(base.rate)}.</p>
            {foods.length ? <RateTable rows={foods} base={base.rate} label="Food" /> : <p className="hint">No food eaten 3 or more times yet.</p>}
          </section>

          {placeRows.length > 0 && (
            <section>
              <h3>Places</h3>
              <RateTable rows={placeRows} base={base.rate} label="Place" />
            </section>
          )}
        </>
      )}

      {factors.length > 0 && (
        <section>
          <h3>Other factors</h3>
          <p className="hint">Days with symptoms {settings.reactionSeverity}/10+, compared with other check-in days.</p>
          <table className="history">
            <thead>
              <tr>
                <th>Factor</th>
                <th className="num">On those days</th>
                <th className="num">Other days</th>
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f.label}>
                  <td>{f.label}</td>
                  <td className="num">
                    {f.withReactions}/{f.withDays} ({pct(f.withReactions / f.withDays)})
                  </td>
                  <td className="num">
                    {f.otherReactions}/{f.otherDays} ({pct(f.otherReactions / f.otherDays)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {counts.length > 0 && (
        <section>
          <h3>Most common symptoms</h3>
          <table className="history">
            <tbody>
              {counts.map((c) => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td className="num">{c.count} times</td>
                  <td className="num">avg {c.avgSeverity.toFixed(1)}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card note">
        <h2>Reading these patterns</h2>
        <p>These tables show what happened together, not what caused it. A meal can line up with symptoms by chance, and a few meals make a shaky rate.</p>
        <p>Reactions to gluten can take hours or a couple of days, which is what the window above is for. Stress, sleep, other foods (such as dairy or high-fibre foods) and illness can cause similar symptoms.</p>
        <p>Use this to bring specific questions to a doctor or dietitian. Don't eat gluten on purpose to test a pattern.</p>
      </section>
    </div>
  );
}
