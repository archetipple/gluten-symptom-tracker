import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, DEFAULT_SYMPTOMS, exportAll, importAll } from '../../db/db';
import type { Settings } from '../../domain/types';
import { AccountCard } from '../components/AccountCard';
import { Header, Scale } from '../components/common';
import { useSettings } from '../data';

export function SettingsPage() {
  const nav = useNavigate();
  const s = useSettings();
  const save = (p: Partial<Settings>) => void db.settings.put({ ...s, ...p });
  const [newType, setNewType] = useState('');
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  return (
    <div className="page">
      <Header title="Settings" back={() => nav(-1)} />

      <section className="card">
        <Link className="row clickable plain-link" to="/foods">
          <span className="grow">My foods</span>
          <span className="chev">›</span>
        </Link>
        <Link className="row clickable plain-link" to="/meds">
          <span className="grow">Meds and supplements</span>
          <span className="chev">›</span>
        </Link>
      </section>

      <section className="card form">
        <h2>Patterns</h2>
        <label>
          Look back how many hours before a symptom?
          <select value={s.windowHours} onChange={(e) => save({ windowHours: Number(e.target.value) })} aria-label="Window hours">
            {[6, 12, 24, 48, 72].map((h) => (
              <option key={h} value={h}>
                {h} hours
              </option>
            ))}
          </select>
          <span className="hint">Gluten reactions often show up within hours but can take up to two or three days.</span>
        </label>
        <span className="label">Count a symptom as a reaction from severity</span>
        <Scale n={10} value={s.reactionSeverity} label="Reaction severity" onChange={(v) => v && save({ reactionSeverity: v })} />
      </section>

      <section className="card form">
        <h2>What to track</h2>
        <label className="inline">
          <input type="checkbox" checked={s.trackBowel} onChange={(e) => save({ trackBowel: e.target.checked })} /> Bowel movements (Bristol scale)
        </label>
        <label className="inline">
          <input type="checkbox" checked={s.trackPeriod} onChange={(e) => save({ trackPeriod: e.target.checked })} /> Period
        </label>
      </section>

      <section className="card form">
        <h2>Symptom list</h2>
        <div className="list">
          {s.symptomTypes.map((t, i) => (
            <div className="row" key={t}>
              <span className="grow">{t}</span>
              <button type="button" className="tiny" aria-label={`Move ${t} up`} disabled={i === 0} onClick={() => save({ symptomTypes: s.symptomTypes.map((x, j) => (j === i - 1 ? t : j === i ? s.symptomTypes[i - 1] : x)) })}>
                ↑
              </button>
              <button type="button" className="tiny" aria-label={`Remove ${t}`} onClick={() => save({ symptomTypes: s.symptomTypes.filter((x) => x !== t) })}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newType.trim();
            if (t && !s.symptomTypes.includes(t)) save({ symptomTypes: [...s.symptomTypes, t] });
            setNewType('');
          }}
        >
          <input placeholder="Add a symptom" value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="New symptom" />
          <button type="submit" className="small" disabled={!newType.trim()}>
            Add
          </button>
        </form>
        <button type="button" className="ghost small" onClick={() => confirm('Reset the symptom list to the defaults? Past entries are kept.') && save({ symptomTypes: DEFAULT_SYMPTOMS })}>
          Reset to defaults
        </button>
      </section>

      <AccountCard />

      <section className="card form">
        <h2>Backup</h2>
        <div className="bottom-actions">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const blob = new Blob([JSON.stringify(await exportAll(), null, 1)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `celiac-tracker-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download backup
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            Restore backup
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const payload = JSON.parse(await f.text());
              if (payload.app !== 'celiac-tracker' || !payload.data) throw new Error('This is not a Celiac Tracker backup.');
              if (!confirm('Replace everything on this device with this backup?')) return;
              await importAll(payload);
              setMsg('Backup restored.');
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        />
        {msg && <p className="hint">{msg}</p>}
      </section>

      <p className="hint center">
        This app is a personal diary, not medical advice. Gluten checks use Open Food Facts, which volunteers keep up to date, so always read the package label.
      </p>
    </div>
  );
}
