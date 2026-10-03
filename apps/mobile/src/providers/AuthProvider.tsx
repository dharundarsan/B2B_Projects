import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase, previewEnabled } from '../lib/supabase';
import { api, ApiError } from '../lib/api';
import { createPreviewClient } from '../lib/demo';
import type { MobileContext, MobileRole } from '../types';

interface AuthValue {
  loading: boolean; context: MobileContext | null; error: string; session: Session | null;
  client: typeof api; preview: boolean; signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>; enterPreview(role: MobileRole): void; refreshContext(): void;
}
const Auth = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [previewRole, setPreviewRole] = useState<MobileRole | null>(null);
  const [context, setContext] = useState<MobileContext | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, refresh] = useState(0);
  const client = useMemo(() => previewRole ? createPreviewClient(previewRole) : api, [previewRole, session?.user.id]);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let mounted = true; let observedEvent = false; let identity: string | null = null;
    const adopt = (next: Session | null) => {
      if (identity !== (next?.user.id ?? null)) { identity = next?.user.id ?? null; setContext(null); setLoading(!!next); }
      if (!next) setLoading(false);
      setSession(next);
    };
    supabase.auth.getSession().then(({ data, error }) => { if (mounted && !observedEvent) { adopt(data.session); if (error) setError(error.message); } }).catch(() => { if (mounted && !observedEvent) { setError('Could not restore your session. Sign in again.'); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (mounted) { observedEvent = true; adopt(next); setError(''); } });
    const syncRefresh = (state: string) => { if (Platform.OS !== 'web') { if (state === 'active') supabase?.auth.startAutoRefresh(); else supabase?.auth.stopAutoRefresh(); } };
    syncRefresh(AppState.currentState);
    const listener = AppState.addEventListener('change', syncRefresh);
    return () => { mounted = false; data.subscription.unsubscribe(); listener.remove(); if (Platform.OS !== 'web') supabase?.auth.stopAutoRefresh(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let mounted = true;
    if (!session && !previewRole) { setContext(null); return; }
    if (!context) setLoading(true);
    setError('');
    client.context(controller.signal).then(value => { if (mounted) setContext(value); }).catch(err => {
      if (mounted) { setError(err instanceof Error ? err.message : 'Could not load your account.'); if (err instanceof ApiError && [401, 403].includes(err.status)) setContext(null); }
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; controller.abort(); };
  }, [client, session?.access_token, previewRole, revision]);
  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Configure the public Supabase URL and key in apps/mobile/.env first.');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error; setPreviewRole(null);
  };
  const signOut = async () => {
    if (previewRole) { setPreviewRole(null); setContext(null); return; }
    const result = await supabase?.auth.signOut({ scope: 'local' }); if (result?.error) throw result.error;
    setContext(null); setSession(null); setError('');
  };
  return <Auth.Provider value={{ loading, context, error, session, client, preview: !!previewRole, signIn, signOut,
    enterPreview: role => { if (previewEnabled) { setContext(null); setLoading(true); setPreviewRole(role); } }, refreshContext: () => refresh(value => value + 1) }}>{children}</Auth.Provider>;
}
export function useAuth() { const value = useContext(Auth); if (!value) throw new Error('AuthProvider is required.'); return value; }
