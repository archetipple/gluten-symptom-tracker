import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import { changePassword, cloudConfigured, getStatus, signIn, signOut, signUp, subscribe, syncNow, type SyncStatus } from '../../sync/cloud';

function useSyncStatus(): SyncStatus {
  const [s, setS] = useState(getStatus());
  useEffect(() => subscribe(setS), []);
  return s;
}

function ago(iso?: string): string {
  if (!iso) return 'not yet';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function AccountCard() {
  const s = useSyncStatus();
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newPw, setNewPw] = useState<string | null>(null);

  if (!cloudConfigured) {
    return (
      <section className="card form">
        <h2>Account and sync</h2>
        <p className="hint">Cloud sync isn't set up for this app yet, so data stays on this device. Use Download backup below.</p>
      </section>
    );
  }

  if (s.state === 'signed-out' || !s.user) {
    const create = mode === 'create';
    return (
      <section className="card form">
        <h2>Account and sync</h2>
        <p className="hint">Sign in to back up to the cloud and use the app on more than one device.</p>
        <div className="seg wide" role="tablist">
          <button type="button" className={!create ? 'on' : ''} onClick={() => (setMode('signin'), setMsg(''))}>
            Sign in
          </button>
          <button type="button" className={create ? 'on' : ''} onClick={() => (setMode('create'), setMsg(''))}>
            Create account
          </button>
        </div>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg('');
            try {
              if (create) {
                const u = await signUp(email, password);
                if (!u) {
                  setMsg('Account created, but Supabase wants the email confirmed first. Turn off "Confirm email" in Supabase, or open the email it sent, then sign in.');
                  setMode('signin');
                  return;
                }
              } else {
                await signIn(email, password);
              }
              setMode('signin'); // what you'll want after signing out later
              setPassword('');
              await syncNow();
            } catch (err) {
              setMsg((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input type="email" required autoComplete={create ? 'username' : 'username'} value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          </label>
          <label>
            Password {create && <span className="hint">(at least 8 characters)</span>}
            <input
              type="password"
              required
              minLength={create ? 8 : undefined}
              autoComplete={create ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '…' : create ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {msg && <p className="warn">{msg}</p>}
      </section>
    );
  }

  return (
    <section className="card form">
      <h2>Account and sync</h2>
      <div>
        <div className="title">{s.user.email}</div>
        <div className={'sub' + (s.state === 'error' ? ' warn' : '')}>
          {s.state === 'syncing'
            ? 'Syncing…'
            : s.state === 'error'
              ? `Sync problem: ${s.error}`
              : `Last synced ${ago(s.lastSync)}${pending ? ` · ${pending} change${pending === 1 ? '' : 's'} waiting` : ' · up to date'}`}
        </div>
        {s.state !== 'error' && s.error && <div className="sub">{s.error}</div>}
      </div>
      <div className="bottom-actions">
        <button type="button" className="btn" onClick={() => void syncNow()} disabled={s.state === 'syncing'}>
          Sync now
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            if (confirm('Sign out? Your data stays on this device and in the cloud.')) await signOut();
          }}
        >
          Sign out
        </button>
      </div>
      {newPw === null ? (
        <button type="button" className="ghost small" onClick={() => setNewPw('')}>
          Change password
        </button>
      ) : (
        <form
          className="search-row"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await changePassword(newPw);
              setNewPw(null);
              setMsg('Password changed.');
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        >
          <input type="password" autoComplete="new-password" minLength={8} required placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} aria-label="New password" />
          <button type="submit" className="small">
            Save
          </button>
        </form>
      )}
      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}
