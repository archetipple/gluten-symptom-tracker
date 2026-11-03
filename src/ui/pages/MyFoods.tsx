import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, newId } from '../../db/db';
import type { Food, GlutenStatus } from '../../domain/types';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { FoodEditor, blankFood } from '../components/FoodEditor';
import { Chip, GlutenTag, Header, Star } from '../components/common';
import { findByBarcode } from '../barcodeLookup';
import { useFoods } from '../data';

const FILTERS: { label: string; test: (g: GlutenStatus) => boolean }[] = [
  { label: 'All', test: () => true },
  { label: 'Safe', test: (g) => g === 'gf_label' || g === 'naturally_gf' },
  { label: 'Caution', test: (g) => g === 'may_contain' || g === 'unknown' },
  { label: 'Gluten', test: (g) => g === 'contains' },
];

/** Your foods: a safe list, a caution list, and foods to avoid. */
export function MyFoods() {
  const nav = useNavigate();
  const foods = useFoods();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(0);
  const [scan, setScan] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<{ food: Food; isNew: boolean } | null>(null);

  const term = q.trim().toLowerCase();
  const shown = foods
    .filter((f) => FILTERS[filter].test(f.gluten))
    .filter((f) => !term || `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(term))
    .sort((a, b) => Number(b.favourite) - Number(a.favourite));

  return (
    <div className="page">
      <Header title="My foods" back={() => nav(-1)} />
      <p className="hint">Scan a product in the store to check it. Save it to build a list of foods you know are safe.</p>
      <button type="button" className="btn primary scan-btn" onClick={() => setScan(true)}>
        ▦ Check a barcode
      </button>
      {msg && <p className="warn">{msg}</p>}
      <input type="search" placeholder="Search my foods" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search my foods" />
      <div className="chips">
        {FILTERS.map((f, i) => (
          <Chip key={f.label} on={filter === i} onClick={() => setFilter(i)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="list">
        {shown.map((f) => (
          <div className="row" key={f.id}>
            <Star on={f.favourite} onClick={() => void db.foods.update(f.id, { favourite: !f.favourite })} />
            <button type="button" className="plain grow left" onClick={() => setEditing({ food: f, isNew: false })}>
              <span className="title">{f.name}</span>
              {f.brand && <span className="sub"> · {f.brand}</span>}
              {f.notes && <span className="sub block">{f.notes}</span>}
            </button>
            <GlutenTag status={f.gluten} short />
          </div>
        ))}
      </div>
      {!shown.length && <p className="empty">{foods.length ? 'No foods match.' : 'No foods yet. Scan one, or add foods while logging meals.'}</p>}
      <button type="button" className="btn" onClick={() => setEditing({ food: blankFood(newId(), q.trim()), isNew: true })}>
        + New food
      </button>

      {scan && (
        <BarcodeScanner
          onClose={() => setScan(false)}
          onResult={async (code) => {
            setScan(false);
            setMsg('');
            const hit = await findByBarcode(code);
            if (!hit) setMsg(`No product found for ${code}. Check the label and add it yourself.`);
            else setEditing({ food: hit.food, isNew: !hit.saved });
          }}
        />
      )}
      {editing && <FoodEditor food={editing.food} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}
