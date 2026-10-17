import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const html = await readFile('dist/index.html', 'utf8');
const manifestUrl = html.match(/href=["']([^"']*manifest\.webmanifest)["']/)?.[1];
assert(manifestUrl, 'マニフェストの参照がありません');
const base = manifestUrl.slice(0, -'manifest.webmanifest'.length);
assert(base.startsWith('/') && base.endsWith('/'), 'baseパスが不正です');
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.start_url, base);
assert.equal(manifest.scope, base);
assert.equal(manifest.id, base);
const paths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
paths.push(...manifest.icons.map((icon) => icon.src));
for (const path of paths) {
  assert(path.startsWith(base), `公開先から外れたパス: ${path}`);
  await access(join('dist', path.slice(base.length)));
}
const worker = await readFile('dist/sw.js', 'utf8');
assert(worker.includes(`${base}index.html`), 'オフライン復元先が公開先に一致していません');
assert(worker.includes(`${base}manifest.webmanifest`), 'キャッシュ先が公開先に一致していません');
const scripts = await Promise.all(
  (await readdir('dist/assets'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFile(join('dist/assets', file), 'utf8')),
);
assert(
  scripts.some((script) => script.includes(`${base}sw.js`)),
  'Service Workerの登録先が一致していません',
);
await access('dist/.nojekyll');
console.log(
  `Pages build verified: base=${base}, HTML, manifest, icons, worker and local files match.`,
);
