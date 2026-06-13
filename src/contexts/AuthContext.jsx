import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export const AUTHORIZED_EMAIL = 'leandroalmeida861@gmail.com';

const USERS_KEY = 'agroflow_contratos_usuarios_liberados_v1';
const SESSION_KEY = 'agroflow_contratos_sessao_local_v1';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [localUser, setLocalUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedLocalUser = getLocalSession();
    setLocalUser(isSupabaseConfigured ? null : savedLocalUser);

    if (!isSupabaseConfigured) {
      setAuthorized(Boolean(savedLocalUser));
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthorized(isAuthorized(data.session?.user?.email));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthorized(isAuthorized(nextSession?.user?.email));
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const normalized = normalizeEmail(email);
    const savedUser = getApprovedUser(normalized);

    if (!password) throw new Error('Digite a senha para entrar. Como corrigir: informe a senha cadastrada para este e-mail.');

    if (normalized === AUTHORIZED_EMAIL) {
      if (!isSupabaseConfigured) throw new Error('Supabase não configurado. Como corrigir: confira as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      clearLocalSession();
      setLocalUser(null);
      const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (error) throw error;
      setAuthorized(true);
      return;
    }

    if (savedUser) {
      if (savedUser.password !== password) throw new Error('Senha incorreta para este e-mail. Como corrigir: confira se digitou a senha criada em Solicitar acesso ou use Alterar senha de usuario liberado.');

      if (!isSupabaseConfigured) {
        const nextLocalUser = { email: normalized, name: savedUser.name || 'Usuario autorizado' };
        saveLocalSession(nextLocalUser);
        setLocalUser(nextLocalUser);
        setAuthorized(true);
        return;
      }

      const signedIn = await signInApprovedSupabaseUser(normalized, password);
      if (!signedIn) {
        throw new Error('Acesso liberado, mas o Supabase ainda não criou uma sessão para este e-mail. Como corrigir: confirme o e-mail se o Supabase enviar confirmação, depois tente entrar novamente.');
      }
      setAuthorized(true);
      return;
    }

    if (normalized !== AUTHORIZED_EMAIL) {
      throw new Error('Este e-mail ainda nao foi liberado. Como corrigir: clique em Solicitar acesso e aguarde a liberacao pelo administrador.');
    }
    throw new Error('Este e-mail ainda nao foi liberado. Como corrigir: clique em Solicitar acesso e aguarde a liberacao pelo administrador.');
  }

  async function approveLocalAccess({ email, name, password }) {
    const normalized = normalizeEmail(email);
    if (!normalized || !password) throw new Error('Link de liberacao incompleto. Como corrigir: abra o link completo recebido no e-mail de pedido de acesso.');

    const users = getApprovedUsers();
    users[normalized] = {
      ...(users[normalized] || {}),
      email: normalized,
      name: name || users[normalized]?.name || 'Usuario autorizado',
      password,
      approvedBy: AUTHORIZED_EMAIL,
      approvedAt: new Date().toISOString(),
    };
    saveApprovedUsers(users);

    const databaseApproval = await approveEmailInSupabase(normalized, users[normalized].name);
    return { ...users[normalized], databaseApproval };
  }

  function changeApprovedPassword(email, password, confirmPassword) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Informe o e-mail do usuario liberado. Como corrigir: digite o mesmo e-mail que foi aprovado pelo administrador.');
    if (normalized === AUTHORIZED_EMAIL && isSupabaseConfigured) throw new Error('A senha do administrador é a senha do Supabase. Como corrigir: entre com a senha cadastrada no Supabase ou redefina a senha pela tela de autenticação do Supabase.');
    if (!isAuthorized(normalized)) throw new Error('Este e-mail ainda nao foi liberado. Como corrigir: clique em Solicitar acesso e aguarde o administrador abrir o link de liberacao.');
    if (password.length < 6) throw new Error('Crie uma senha com pelo menos 6 caracteres. Como corrigir: use uma senha maior antes de salvar.');
    if (password !== confirmPassword) throw new Error('A confirmacao da senha nao confere. Como corrigir: digite a mesma senha nos dois campos.');

    const users = getApprovedUsers();
    users[normalized] = {
      ...(users[normalized] || {}),
      email: normalized,
      name: users[normalized]?.name || (normalized === AUTHORIZED_EMAIL ? 'Leandro Almeida' : 'Usuario autorizado'),
      password,
      updatedAt: new Date().toISOString(),
    };
    saveApprovedUsers(users);
    return users[normalized];
  }

  async function signOut() {
    clearLocalSession();
    setLocalUser(null);
    setAuthorized(false);
    if (supabase) await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user || localUser,
      authorized,
      loading,
      signIn,
      approveLocalAccess,
      changeApprovedPassword,
      signOut,
      configured: true,
    }),
    [session, localUser, authorized, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}

function isAuthorized(email) {
  const normalized = normalizeEmail(email);
  return normalized === AUTHORIZED_EMAIL || Boolean(getApprovedUser(normalized));
}

function getApprovedUser(email) {
  return getApprovedUsers()[normalizeEmail(email)];
}

function getApprovedUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveApprovedUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getLocalSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveLocalSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearLocalSession() {
  localStorage.removeItem(SESSION_KEY);
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

async function signInApprovedSupabaseUser(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return true;

  const message = String(error.message || '').toLowerCase();
  if (!message.includes('invalid login credentials')) throw error;

  const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) throw signUpError;
  return Boolean(data?.session);
}

async function approveEmailInSupabase(email, name) {
  if (!isSupabaseConfigured) return { ok: false, reason: 'supabase-desligado' };

  const { data: sessionData } = await supabase.auth.getSession();
  const currentEmail = normalizeEmail(sessionData?.session?.user?.email);
  if (currentEmail !== AUTHORIZED_EMAIL) return { ok: false, reason: 'admin-sem-sessao' };

  const { error } = await supabase.rpc('agroflow_liberar_email_direto', {
    p_email: email,
    p_nome: name || 'Usuario autorizado',
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
