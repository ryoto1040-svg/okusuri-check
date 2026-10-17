/** GitHub PagesのプロジェクトURLとドメイン直下の両方に対応する。 */
export function normalizeBasePath(value = '/'): string {
  const path = value.trim();
  if (!path || path === '/') return '/';
  const parts = path.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.some((part) => !/^[A-Za-z0-9._~-]+$/.test(part) || part === '.' || part === '..')) {
    throw new Error('VITE_BASE_PATHには /リポジトリ名/ の形式のパスを指定してください。');
  }
  return `/${parts.join('/')}/`;
}
