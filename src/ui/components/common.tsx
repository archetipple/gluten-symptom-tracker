import { useEffect, useState, type ReactNode } from 'react';
import { GLUTEN_TONE, RISK_LABELS, type MealRisk } from '../../domain/gluten';
import { GLUTEN_LABELS, type GlutenStatus } from '../../domain/types';

export function Chip(props: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={'chip' + (props.on ? ' on' : '')} aria-pressed={props.on} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function Star(props: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={'star' + (props.on ? ' on' : '')}
      aria-label={props.on ? 'Remove from favourites' : 'Add to favourites'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onClick();
      }}
    >
      {props.on ? '★' : '☆'}
    </button>
  );
}

export function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

/** Number input that keeps its own text while typing; empty reports undefined. */
export function NumberInput(props: { value: number | undefined; onChange: (n: number | undefined) => void; min?: number; max?: number; label?: string; placeholder?: string }) {
  const [text, setText] = useState(props.value === undefined ? '' : String(props.value));
  useEffect(() => {
    const cur = text === '' ? undefined : Number(text);
    if (cur !== props.value) setText(props.value === undefined ? '' : String(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={props.min}
      max={props.max}
      aria-label={props.label}
      placeholder={props.placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value === '') return props.onChange(undefined);
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) props.onChange(n);
      }}
    />
  );
}

/** A row of numbered buttons (1 to n); tapping the chosen one clears it unless `clearable` is false. */
export function Scale(props: { n: number; value?: number; onChange: (v: number | undefined) => void; low?: string; high?: string; label: string; tone?: 'severity' | 'plain'; clearable?: boolean }) {
  const clearable = props.clearable ?? true;
  return (
    <div className="scale-wrap">
      <div className={'scale' + (props.tone === 'severity' ? ' severity' : '')} role="group" aria-label={props.label} style={{ gridTemplateColumns: `repeat(${props.n}, minmax(0, 1fr))` }}>
        {Array.from({ length: props.n }, (_, i) => i + 1).map((v) => (
          <button type="button" key={v} className={props.value === v ? 'on' : ''} data-v={v} aria-pressed={props.value === v} onClick={() => props.onChange(props.value === v ? (clearable ? undefined : v) : v)}>
            {v}
          </button>
        ))}
      </div>
      {(props.low || props.high) && (
        <div className="scale-ends">
          <span>{props.low}</span>
          <span>{props.high}</span>
        </div>
      )}
    </div>
  );
}

export function GlutenTag(props: { status: GlutenStatus; short?: boolean }) {
  const tone = GLUTEN_TONE[props.status];
  const short: Record<GlutenStatus, string> = { gf_label: 'GF label', naturally_gf: 'Naturally GF', may_contain: 'May contain', contains: 'Gluten', unknown: 'Not checked' };
  return <span className={`tag ${tone}`}>{props.short ? short[props.status] : GLUTEN_LABELS[props.status]}</span>;
}

const RISK_TONE: Record<MealRisk, string> = { low: 'safe', unsure: 'unsure', possible: 'risk', gluten: 'gluten' };
export function RiskTag(props: { risk: MealRisk }) {
  return <span className={`tag ${RISK_TONE[props.risk]}`}>{RISK_LABELS[props.risk]}</span>;
}

export function SeverityTag(props: { severity: number }) {
  const tone = props.severity >= 7 ? 'gluten' : props.severity >= 4 ? 'risk' : 'unsure';
  return <span className={`tag ${tone}`}>{props.severity}/10</span>;
}

export function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" onClick={props.onClose}>
      <div className="modal" role="dialog" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{props.title}</h2>
          <button type="button" className="ghost" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

export function Header(props: { title: string; back?: () => void; right?: ReactNode }) {
  return (
    <div className="label-row page-head">
      {props.back && (
        <button type="button" className="ghost back" onClick={props.back} aria-label="Back">
          ‹
        </button>
      )}
      <h1 className="grow">{props.title}</h1>
      {props.right}
    </div>
  );
}
