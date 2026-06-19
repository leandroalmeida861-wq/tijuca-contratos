import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
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
  const authorizationRequestRef = useRef(0);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setAuthorized(false);
      setProfile(null);
      setProfileData(null);
      setPermissions({});
      setAccess(null);
      setLoading(false);
      return undefined;
    }

    async function synchronizeSession(nextSession) {
      const requestId = ++authorizationRequestRef.current;
      if (!active) return;

      setSession(nextSession);
      setLoading(true);

      if (!nextSession) {
        applyAuthorizationState(null);
        setLoading(false);
        return;
      }

      try {
        const authorization = await loadAuthorization(
          nextSession.user?.email,
          nextSession.access_token,
        );
        if (active && requestId === authorizationRequestRef.current) {
          applyAuthorizationState(authorization);
        }
      } finally {
        if (active && requestId === authorizationRequestRef.current) {
          setLoading(false);
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => synchronizeSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        synchronizeSession(nextSession);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    const normalized = normalizeEmail(email);

    if (!password) throw new Error('Digite a senha para entrar. Como corrigir: informe a senha cadastrada para este e-mail.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao configurado. Como corrigir: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.');
    }

    await supabase.auth.signOut({ scope: 'local' });
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      throw error;
    }

    setSession(signInData.session);
    const authorization = await loadAuthorization(normalized, signInData.session?.access_token);
    if (!authorization?.authorized) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('Este e-mail ainda nao foi liberado pelo administrador. Como corrigir: aguarde a aprovacao do acesso e tente novamente.');
    }

    applyAuthorizationState(authorization);
    await supabase.rpc('agroflow_auditar', { action_name: 'login', table_name: 'auth', record_id: null, old_data: null, new_data: null });
  }

  async function signOut() {
    setAuthorized(false);
    setProfile(null);
    setProfileData(null);
    setPermissions({});
    setAccess(null);
    if (supabase) await supabase.auth.signOut({ scope: 'local' });
  }

  function applyAuthorizationState(authorization) {
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
  if (!normalized || !accessToken || !isSupabaseConfigured) return { authorized: false };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('/api/auth/acesso', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload.authorized) {
        return {
          authorized: true,
          profile: payload.profile,
          profileData: payload.profileData,
          permissions: permissionsToMap(payload.permissions || []),
          access: payload.access,
        };
      }

      if (response.status === 403) return { authorized: false };
    } catch {
      // A renovacao da sessao pode causar uma falha de rede momentanea.
    }

    if (attempt < 2) await wait(250 * (attempt + 1));
  }

  return { authorized: false };
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
