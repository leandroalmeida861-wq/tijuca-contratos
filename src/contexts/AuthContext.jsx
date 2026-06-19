import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createSessionClient, isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { permissionsToMap } from '../lib/permissions.js';

export const AUTHORIZED_EMAIL = 'leandroalmeida861@gmail.com';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthorized(false);
      setProfile(null);
      setProfileData(null);
      setPermissions({});
      setAccess(null);
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await applyAuthorization(data.session?.user?.email, data.session?.access_token);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      window.setTimeout(() => {
        applyAuthorization(nextSession?.user?.email, nextSession?.access_token).finally(() => setLoading(false));
      }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const normalized = normalizeEmail(email);

    if (!password) throw new Error('Digite a senha para entrar. Como corrigir: informe a senha cadastrada para este e-mail.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao configurado. Como corrigir: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.');
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      throw error;
    }

    setSession(signInData.session);
    const authorization = await loadAuthorization(normalized, signInData.session?.access_token);
    if (!authorization?.authorized) {
      await supabase.auth.signOut();
      throw new Error('Este e-mail ainda nao foi liberado pelo administrador. Como corrigir: aguarde a aprovacao do acesso e tente novamente.');
    }

    setAuthorized(true);
    setProfile(authorization.profile);
    setProfileData(authorization.profileData);
    setPermissions(authorization.permissions);
    setAccess(authorization.access);
    await supabase.rpc('agroflow_auditar', { action_name: 'login', table_name: 'auth', record_id: null, old_data: null, new_data: null });
  }

  async function signOut() {
    setAuthorized(false);
    setProfile(null);
    setProfileData(null);
    setPermissions({});
    setAccess(null);
    if (supabase) await supabase.auth.signOut();
  }

  async function applyAuthorization(email, accessToken) {
    const authorization = await loadAuthorization(email, accessToken);
    setAuthorized(Boolean(authorization?.authorized));
    setProfile(authorization?.profile || null);
    setProfileData(authorization?.profileData || null);
    setPermissions(authorization?.permissions || {});
    setAccess(authorization?.access || null);
  }

  function can(menu, action = 'visualizar') {
    if (profile === 'admin') return true;
    return Boolean(permissions?.[menu]?.[action]);
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      authorized,
      profile,
      profileData,
      permissions,
      can,
      access,
      loading,
      signIn,
      signOut,
      configured: isSupabaseConfigured,
    }),
    [session, authorized, profile, profileData, permissions, access, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}

async function loadAuthorization(email, accessToken) {
  const normalized = normalizeEmail(email);
  if (!normalized || !isSupabaseConfigured) return { authorized: false };

  const sessionClient = createSessionClient(accessToken);
  await sessionClient.rpc('agroflow_ensure_profile');
  const [{ data, error }, { data: permissionRows, error: permissionError }] = await Promise.all([
    sessionClient.rpc('agroflow_profile_atual'),
    sessionClient.rpc('agroflow_permissoes_atuais'),
  ]);
  if (error || permissionError) return { authorized: normalized === AUTHORIZED_EMAIL, profile: 'admin', permissions: {} };

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.ativo) {
    return {
      authorized: true,
      profile: row.perfil || (normalized === AUTHORIZED_EMAIL ? 'admin' : 'operador'),
      profileData: row,
      permissions: permissionsToMap(permissionRows || []),
      access: row,
    };
  }

  return { authorized: normalized === AUTHORIZED_EMAIL, profile: normalized === AUTHORIZED_EMAIL ? 'admin' : null };
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}
