import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export const AUTHORIZED_EMAIL = 'leandroalmeida861@gmail.com';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthorized(false);
      setProfile(null);
      setAccess(null);
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await applyAuthorization(data.session?.user?.email);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await applyAuthorization(nextSession?.user?.email);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const normalized = normalizeEmail(email);

    if (!password) throw new Error('Digite a senha para entrar. Como corrigir: informe a senha cadastrada para este e-mail.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao configurado. Como corrigir: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      throw error;
    }

    const authorization = await loadAuthorization(normalized);
    if (!authorization?.authorized) {
      await supabase.auth.signOut();
      throw new Error('Este e-mail ainda nao foi liberado pelo administrador. Como corrigir: aguarde a aprovacao do acesso e tente novamente.');
    }

    setAuthorized(true);
    setProfile(authorization.profile);
    setAccess(authorization.access);
  }

  async function signOut() {
    setAuthorized(false);
    setProfile(null);
    setAccess(null);
    if (supabase) await supabase.auth.signOut();
  }

  async function applyAuthorization(email) {
    const authorization = await loadAuthorization(email);
    setAuthorized(Boolean(authorization?.authorized));
    setProfile(authorization?.profile || null);
    setAccess(authorization?.access || null);
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      authorized,
      profile,
      access,
      loading,
      signIn,
      signOut,
      configured: isSupabaseConfigured,
    }),
    [session, authorized, profile, access, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}

async function loadAuthorization(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !isSupabaseConfigured) return { authorized: false };

  const { data, error } = await supabase.rpc('agroflow_usuario_atual');
  if (error) return { authorized: normalized === AUTHORIZED_EMAIL, profile: 'admin' };

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.status === 'ativo') {
    return {
      authorized: true,
      profile: row.perfil || (normalized === AUTHORIZED_EMAIL ? 'admin' : 'operador'),
      access: row,
    };
  }

  return { authorized: normalized === AUTHORIZED_EMAIL, profile: normalized === AUTHORIZED_EMAIL ? 'admin' : null };
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}
