import { useState } from 'react';
import { newId } from '../../db/db';
import { searchOpenFoodFacts } from '../../domain/foods';
import type { Food } from '../../domain/types';
import { findByBarcode } from '../barcodeLookup';
import { useFoods } from '../data';
import { BarcodeScanner } from './BarcodeScanner';
import { FoodEditor, blankFood } from './FoodEditor';
import { GlutenTag } from './common';

/**
 * Find a food four ways: your saved foods, a barcode scan, an Open Food Facts
 * search, or a new food typed in. A food from Open Food Facts opens in the
 * editor first so you can check its gluten status against the package.
 */
export function FoodFinder(props: { onPick: (f: Food) => void; pickLabel?: string }) {
  const foods = useFoods();
  const [q, setQ] = useState('');
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [editing, setEditing] = useState<{ food: Food; isNew: boolean } | null>(null);

  const term = q.trim().toLowerCase();
  const mine = term
    ? foods.filter((f) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(term))
    : foods.filter((f) => f.favourite).concat(foods.filter((f) => !f.favourite)).slice(0, 12);

  const fromBarcode = async (code: string) => {
    setScan(false);
    setBusy(true);
    setMsg('');
    try {
      const hit = await findByBarcode(code);
      if (!hit) setMsg(`No product found for ${code}. Add it yourself below.`);
      else if (hit.saved) props.onPick(hit.food);
      else setEditing({ food: hit.food, isNew: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <button type="button" className="btn primary scan-btn" onClick={() => setScan(true)} disabled={busy}>
        ▦ Scan a barcode
      </button>
      <form
        className="search-row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (/^\d{8,14}$/.test(q.trim())) return fromBarcode(q.trim());
          if (!term) return;
          setBusy(true);
          setMsg('');
          try {
            setResults(await searchOpenFoodFacts(q, newId));
          } catch {
            setMsg('Open Food Facts is not answering. Try again in a minute.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input type="search" placeholder="Search my foods, or a barcode number" value={q} onChange={(e) => (setQ(e.target.value), setResults(null))} aria-label="Search foods" />
        <button type="submit" className="small" disabled={busy || !term}>
          {busy ? '…' : 'Online'}
        </button>
      </form>
      {msg && <p className="warn">{msg}</p>}

      <h3>{term ? 'My foods' : 'My foods (favourites first)'}</h3>
      <div className="list">
        {mine.map((f) => (
          <button type="button" className="row clickable" key={f.id} onClick={() => props.onPick(f)}>
            <span className="grow">
              <span className="title">{f.name}</span>
              {f.brand && <span className="sub"> · {f.brand}</span>}
            </span>
            <GlutenTag status={f.gluten} short />
          </button>
        ))}
      </div>
      {!mine.length && <p className="hint">{foods.length ? 'None of your foods match.' : 'No saved foods yet.'}</p>}
      <button type="button" className="btn" onClick={() => setEditing({ food: blankFood(newId(), q.trim()), isNew: true })}>
        + New food{q.trim() ? ` "${q.trim()}"` : ''}
      </button>

      {results && (
        <>
          <h3>Open Food Facts</h3>
          <div className="list">
            {results.map((f) => (
              <button type="button" className="row clickable" key={f.id} onClick={() => setEditing({ food: f, isNew: true })}>
                <span className="grow">
                  <span className="title">{f.name}</span>
                  {f.brand && <span className="sub"> · {f.brand}</span>}
                </span>
                <GlutenTag status={f.gluten} short />
              </button>
            ))}
          </div>
          {!results.length && <p className="hint">Nothing found online.</p>}
        </>
      )}

      {scan && <BarcodeScanner onResult={(c) => void fromBarcode(c)} onClose={() => setScan(false)} />}
      {editing && (
        <FoodEditor
          food={editing.food}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSaved={(f) => {
            props.onPick(f);
          }}
        />
      )}
    </div>
  );
}

