import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/db';
import { syncOnce, type Remote, type RemoteRow } from './engine';

// Set in Cloudflare Pages > Settings > Variables (build time). The anon/publishable
// key is meant to be public; row level security keeps each account's rows private.
const RAW_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
/** Accept the URL as pasted, e.g. with /rest/v1/ on the end: the client needs only the origin. */
export function supabaseOrigin(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}
const SB_URL = supabaseOrigin(RAW_URL);
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const cloudConfigured = !!(SB_URL && KEY);

let clientPromise: Promise<SupabaseClient> | null = null;
function client(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error('Cloud sync is not set up'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SB_URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }),
  );
  return clientPromise;
}

export interface CloudUser {
  id: string;
  email?: string;
}

export async function currentUser(): Promise<CloudUser | null> {
  if (!cloudConfigured) return null;
  const { data } = await (await client()).auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email } : null;
}

/** Sign in with email and password (works inside the home-screen app; no email step). */
export async function signIn(email: string, password: string): Promise<CloudUser> {
  const { data, error } = await (await client()).auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw new Error(friendly(error?.message));
  return { id: data.user.id, email: data.user.email };
}

/**
 * Create the account. With "Confirm email" turned off in Supabase you are signed
 * in straight away; with it on, Supabase emails a confirmation link first.
 */
export async function signUp(email: string, password: string): Promise<CloudUser | null> {
  const { data, error } = await (await client()).auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(friendly(error.message));
  if (!data.session || !data.user) return null; // needs email confirmation
  return { id: data.user.id, email: data.user.email };
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await (await client()).auth.updateUser({ password });
  if (error) throw new Error(friendly(error.message));
}

function friendly(msg?: string): string {
  if (!msg) return 'Something went wrong. Try again.';
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg)) return 'This account is waiting for email confirmation. Turn off "Confirm email" in Supabase, or open the confirmation email.';
  if (/signups? not allowed|signup is disabled/i.test(msg)) return 'New accounts are turned off for this app. Sign in instead.';
  if (/already registered/i.test(msg)) return 'That email already has an account. Sign in instead.';
  return msg;
}

export async function signOut(): Promise<void> {
  await (await client()).auth.signOut();
  notify();
}

class SupabaseRemote implements Remote {
  constructor(private c: SupabaseClient) {}
  async push(rows: RemoteRow[]) {
    if (!rows.length) return;
    const { error } = await this.c.rpc('push_records', { rows });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  }
  async pull(after: number, limit: number) {
    const { data, error } = await this.c
      .from('records')
      .select('tbl,id,data,deleted,updated_at,seq')
      .gt('seq', after)
      .order('seq', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Download failed: ${error.message}`);
    return (data ?? []) as RemoteRow[];
  }
}

// ---------- Status and scheduling ----------

export interface SyncStatus {
  state: 'off' | 'signed-out' | 'idle' | 'syncing' | 'error';
  user?: CloudUser;
  lastSync?: string;
  error?: string;
}

let status: SyncStatus = { state: cloudConfigured ? 'signed-out' : 'off' };
const listeners = new Set<(s: SyncStatus) => void>();
const set = (s: SyncStatus) => {
  status = s;
  listeners.forEach((l) => l(s));
};
export const getStatus = () => status;
export function subscribe(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  void syncNow();
}

let running: Promise<void> | null = null;
let again = false;

/** Run one sync now (or once more after the current one finishes). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        const user = await currentUser();
        if (!user) {
          set({ state: cloudConfigured ? 'signed-out' : 'off' });
          return;
        }
        if (!navigator.onLine) {
          set({ ...status, state: 'idle', user, error: 'Offline: changes will upload when you reconnect' });
          return;
        }
        set({ ...status, state: 'syncing', user, error: undefined });
        await syncOnce(db, new SupabaseRemote(await client()), user.id);
        const meta = await db.syncMeta.get('state');
        set({ state: 'idle', user, lastSync: meta?.lastSync });
      } while (again);
    } catch (e) {
      set({ ...status, state: 'error', error: (e as Error).message });
    } finally {
      running = null;
    }
  })();
  return running;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
const soon = () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), 4000);
};

/** Sync on start, every minute, when the app comes back to the screen, when back online, and shortly after any change. */
export function startAutoSync(): void {
  if (!cloudConfigured) return;
  void syncNow();
  setInterval(() => void syncNow(), 60000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
  window.addEventListener('online', () => void syncNow());
  db.outbox.hook('creating', () => soon());
  db.outbox.hook('updating', () => soon());
  void client().then((c) => c.auth.onAuthStateChange((event) => event === 'SIGNED_IN' && void syncNow()));
}
