import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AUTH_TAB_NAME_PREFIX = 'agroflow-auth-tab-';
const AUTH_TAB_CLAIM_PREFIX = 'agroflow-auth-tab-claim-';
const SHARED_CODE_VERIFIER_KEY = 'agroflow-auth-code-verifier';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const tabId = getTabId();
const authStorage = {
  getItem(key) {
    if (key.endsWith('-code-verifier')) return window.localStorage.getItem(SHARED_CODE_VERIFIER_KEY);
    return window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (key.endsWith('-code-verifier')) {
      window.localStorage.setItem(SHARED_CODE_VERIFIER_KEY, value);
      return;
    }
    window.sessionStorage.setItem(key, value);
  },
  removeItem(key) {
    if (key.endsWith('-code-verifier')) {
      window.localStorage.removeItem(SHARED_CODE_VERIFIER_KEY);
      return;
    }
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        flowType: 'pkce',
        storage: authStorage,
        storageKey: `agroflow-auth-${tabId}`,
      },
    })
  : null;

function getTabId() {
  const existingId = window.name.startsWith(AUTH_TAB_NAME_PREFIX)
    ? window.name.slice(AUTH_TAB_NAME_PREFIX.length)
    : '';
  const navigationType = window.performance.getEntriesByType('navigation')[0]?.type;
  const existingClaim = existingId
    ? window.localStorage.getItem(`${AUTH_TAB_CLAIM_PREFIX}${existingId}`)
    : null;

  if (existingId && (navigationType === 'reload' || !existingClaim)) {
    window.localStorage.setItem(`${AUTH_TAB_CLAIM_PREFIX}${existingId}`, 'active');
    return existingId;
  }

  const id = window.crypto.randomUUID();
  window.name = `${AUTH_TAB_NAME_PREFIX}${id}`;
  window.localStorage.setItem(`${AUTH_TAB_CLAIM_PREFIX}${id}`, 'active');
  return id;
}
