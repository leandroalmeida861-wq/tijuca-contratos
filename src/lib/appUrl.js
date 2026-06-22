const configuredAppUrl = String(
  import.meta.env.NEXT_PUBLIC_APP_URL || 'https://sistema.agroflow.com.br',
).trim();

export const APP_URL = configuredAppUrl.replace(/\/+$/, '');

export function appUrl(path = '') {
  const normalizedPath = String(path || '');
  return `${APP_URL}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}
