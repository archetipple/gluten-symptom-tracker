import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { mealRisk } from '../../domain/gluten';
import { addDays, dateStr, dayOf, fmtDay, fmtTime } from '../../domain/time';
import { WHERE_LABELS, type Meal, type Place } from '../../domain/types';
import { Header, RiskTag, cap } from '../components/common';
import { usePlaces } from '../data';

export function MealRow(props: { meal: Meal; places: Place[]; showDay?: boolean }) {
  const nav = useNavigate();
  const { meal } = props;
  const place = props.places.find((p) => p.id === meal.placeId);
  return (
    <button type="button" className="row clickable" onClick={() => nav(`/meal/${meal.id}`)}>
      <span className="time">{fmtTime(meal.at)}</span>
      <span className="grow">
        <span className="title">{cap(meal.kind)}</span>
        {meal.where !== 'home' && <span className="sub"> · {place?.name ?? WHERE_LABELS[meal.where]}</span>}
        <span className="sub block">{meal.items.map((i) => i.name).join(', ') || 'No foods listed'}</span>
      </span>
      <RiskTag risk={mealRisk(meal, place).risk} />
    </button>
  );
}

export function FoodLog() {
  const [days, setDays] = useState(14);
  const places = usePlaces();
  const since = addDays(dateStr(), -days + 1);
  const meals = useLiveQuery(() => db.meals.where('at').aboveOrEqual(since).reverse().sortBy('at'), [since]) ?? [];
  const byDay = new Map<string, Meal[]>();
  for (const m of meals) byDay.set(dayOf(m.at), [...(byDay.get(dayOf(m.at)) ?? []), m]);

  return (
    <div className="page">
      <Header
        title="Food"
        right={
          <Link className="btn small" to="/foods">
            My foods
          </Link>
        }
      />
      <Link className="btn primary" to="/meal/new">
        + Log food
      </Link>
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day}>
          <h3>{fmtDay(day)}</h3>
          <div className="list">
            {list.map((m) => (
              <MealRow key={m.id} meal={m} places={places} />
            ))}
          </div>
        </section>
      ))}
      {!meals.length && <p className="empty">No meals in the last {days} days.</p>}
      <button type="button" className="btn" onClick={() => setDays(days + 30)}>
        Show older
      </button>
    </div>
  );
}
