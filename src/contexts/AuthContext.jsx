import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export const AUTHORIZED_EMAIL = 'leandroalmeida861@gmail.com';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setAuthorized(await checkAuthorization(data.session?.user?.email));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setAuthorized(await checkAuthorization(nextSession?.user?.email));
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function checkAuthorization(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    if (normalized === AUTHORIZED_EMAIL) return true;

    try {
      const { data, error } = await supabase.rpc('agroflow_email_liberado', { check_email: normalized });
      if (error) throw error;
      return Boolean(data);
    } catch {
      return false;
    }
  }

  async function signIn(email, password) {
    const normalized = normalizeEmail(email);
    if (!await checkAuthorization(normalized)) {
      throw new Error('Este e-mail ainda nao foi liberado. Como corrigir: clique em Solicitar acesso e aguarde a liberacao pelo administrador.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) throw error;

    if (!await checkAuthorization(normalized)) {
      await supabase.auth.signOut();
      throw new Error('Acesso bloqueado. Como corrigir: solicite liberacao ao administrador.');
    }
  }

  async function signUp(email, password) {
    const normalized = normalizeEmail(email);
    if (!await checkAuthorization(normalized)) {
      throw new Error('E-mail nao liberado. Como corrigir: solicite acesso; a senha deve ser criada dentro do pedido de acesso.');
    }

    const { error } = await supabase.auth.signUp({ email: normalized, password });
    if (error) throw error;
    await supabase.auth.signOut();
  }

  async function createPendingUser(email, password) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Informe o e-mail do solicitante.');

    const { error } = await supabase.auth.signUp({ email: normalized, password });
    if (error && !/already|registered|exists|user/i.test(error.message || '')) throw error;
  }

  async function requestAccess({ nome, email, telefone, observacao }) {
    const normalized = normalizeEmail(email);
    if (!nome?.trim()) throw new Error('Informe o nome do solicitante.');
    if (!normalized) throw new Error('Informe o e-mail do solicitante.');

    const { data, error } = await supabase.rpc('agroflow_solicitar_acesso', {
      p_nome: nome.trim(),
      p_email: normalized,
      p_telefone: telefone?.trim() || '',
      p_observacao: observacao?.trim() || '',
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function approveAccess(token) {
    if (!token) throw new Error('Link de liberacao invalido.');
    if (normalizeEmail(session?.user?.email) !== AUTHORIZED_EMAIL) {
      throw new Error('Entre com o e-mail administrador para liberar este acesso.');
    }

    const { data, error } = await supabase.rpc('agroflow_liberar_acesso', { p_token: token });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      authorized,
      loading,
      signIn,
      signUp,
      createPendingUser,
      requestAccess,
      approveAccess,
      signOut,
      configured: isSupabaseConfigured,
    }),
    [session, authorized, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}
