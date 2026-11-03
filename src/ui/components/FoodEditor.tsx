import { useState } from 'react';
import { db } from '../../db/db';
import { glutenWordsIn } from '../../domain/gluten';
import { GLUTEN_LABELS, type Food, type GlutenStatus } from '../../domain/types';
import { GlutenTag, Modal } from './common';

const STATUSES: GlutenStatus[] = ['gf_label', 'naturally_gf', 'unknown', 'may_contain', 'contains'];

export function blankFood(id: string, name = ''): Food {
  return { id, name, gluten: 'unknown', reasons: [], allergens: [], traces: [], labels: [], source: 'manual', favourite: false, notes: '' };
}

/**
 * Create or correct a food. Open Food Facts is crowd-sourced, so its verdict
 * is a starting point: always check it against the package.
 */
export function FoodEditor(props: { food: Food; isNew: boolean; onClose: () => void; onSaved?: (f: Food) => void }) {
  const [f, setF] = useState<Food>(props.food);
  const set = (p: Partial<Food>) => setF((x) => ({ ...x, ...p }));
  const words = glutenWordsIn(f.ingredients);
  const fromOff = f.source === 'openfoodfacts';

  return (
    <Modal title={props.isNew ? 'New food' : 'Edit food'} onClose={props.onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.name.trim()) return;
          const saved = { ...f, name: f.name.trim(), brand: f.brand?.trim() || undefined };
          await db.foods.put(saved);
          props.onSaved?.(saved);
          props.onClose();
        }}
      >
        <label>
          Name
          <input required value={f.name} onChange={(e) => set({ name: e.target.value })} aria-label="Name" />
        </label>
        <label>
          Brand <span className="hint">(optional)</span>
          <input value={f.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} aria-label="Brand" />
        </label>
        <label>
          Gluten status
          <select value={f.gluten} onChange={(e) => set({ gluten: e.target.value as GlutenStatus })} aria-label="Gluten status">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {GLUTEN_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {fromOff && f.reasons.length > 0 && (
          <div className="note">
            <div className="label-row">
              <span className="label">From Open Food Facts</span>
              <GlutenTag status={props.food.gluten} />
            </div>
            <ul className="reasons">
              {f.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {(f.allergens.length > 0 || f.traces.length > 0) && (
              <p className="hint">
                {f.allergens.length > 0 && <>Allergens: {f.allergens.join(', ')}. </>}
                {f.traces.length > 0 && <>May contain: {f.traces.join(', ')}.</>}
              </p>
            )}
            <p className="hint">This data is entered by volunteers and can be out of date. Check the package label before trusting it.</p>
          </div>
        )}
        <label>
          Ingredients <span className="hint">(optional)</span>
          <textarea rows={3} value={f.ingredients ?? ''} onChange={(e) => set({ ingredients: e.target.value })} aria-label="Ingredients" />
        </label>
        {words.length > 0 && f.gluten !== 'contains' && <p className="warn">Ingredients mention {words.join(', ')}.</p>}
        <label>
          Notes
          <input value={f.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" placeholder="e.g. safe in the blue package only" />
        </label>
        <div className="bottom-actions">
          {!props.isNew && (
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                if (!confirm(`Delete ${f.name}? Meals already logged keep their entries.`)) return;
                await db.foods.delete(f.id);
                props.onClose();
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
    </Modal>
  );
}
