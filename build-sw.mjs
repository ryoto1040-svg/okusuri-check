import { build } from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

// Viteが実際に出力したURLを使い、CLIの --base 指定にも追従する。
const html = await readFile('dist/index.html', 'utf8');
const manifestUrl = html.match(/href=["']([^"']*manifest\.webmanifest)["']/)?.[1];
const base = manifestUrl?.slice(0, -'manifest.webmanifest'.length);
if (
  !base?.startsWith('/') ||
  !base.endsWith('/') ||
  base.split('/').some((part) => part === '..' || part === '.') ||
  base.includes('://')
) {
  throw new Error(
    'ビルド済みHTMLから公開先パスを確認できません。VITE_BASE_PATHを確認してください。',
  );
}
const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
manifest.id = base;
manifest.start_url = base;
manifest.scope = base;
manifest.icons = manifest.icons.map((icon) => ({
  ...icon,
  src: `${base}${icon.src.replace(/^\/+/, '')}`,
}));
await writeFile('dist/manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile('dist/.nojekyll', '');

const assets = await readdir('dist/assets');
const files = [
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  ...assets.map((file) => `assets/${file}`),
];
const precache = files.map((file) => `${base}${file}`);
const hash = createHash('sha256').update(base);
for (const file of files) hash.update(file).update(await readFile(join('dist', file)));
const version = hash.digest('hex').slice(0, 16);
// 同じgithub.ioドメインにある別リポジトリのキャッシュを削除しない。
const prefix = `okusuri-shell-${createHash('sha256').update(base).digest('hex').slice(0, 12)}-`;
await build({
  entryPoints: ['src/sw.ts'],
  outfile: 'dist/sw.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  define: {
    __PRECACHE__: JSON.stringify(precache),
    __CACHE_NAME__: JSON.stringify(`${prefix}${version}`),
    __CACHE_PREFIX__: JSON.stringify(prefix),
    __BASE_PATH__: JSON.stringify(base),
  },
});
console.log(`Offline app shell built for ${base}. Records remain in localStorage.`);
