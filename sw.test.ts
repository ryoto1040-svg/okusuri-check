import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';
const rawSource = await readFile('src/sw.ts', 'utf8');
const variants = new Map(
  await Promise.all(
    ['/', '/okusuri-check/'].map(async (base) => {
      const paths = ['index.html', 'assets/app.js', 'assets/app.css'].map(
        (file) => `${base}${file}`,
      );
      const prefix = `okusuri-shell-${base === '/' ? 'root' : 'project'}-`,
        name = `${prefix}test`;
      const source = (
        await transform(rawSource, {
          loader: 'ts',
          format: 'iife',
          define: {
            __PRECACHE__: JSON.stringify(paths),
            __CACHE_NAME__: JSON.stringify(name),
            __CACHE_PREFIX__: JSON.stringify(prefix),
            __BASE_PATH__: JSON.stringify(base),
          },
        })
      ).code;
      return [base, { paths, prefix, name, source }] as const;
    }),
  ),
);
function fixture(base: string, failInstall = false) {
  const { paths, prefix, name, source } = variants.get(base)!;
  const contents = new Map<string, Map<string, Response>>();
  const handlers: Record<string, (event: any) => void> = {};
  const skipWaiting = vi.fn(async () => {}),
    claim = vi.fn(async () => {});
  const fetch = vi.fn(async () => {
    throw new Error('offline');
  });
  const caches = {
    keys: async () => [...contents.keys()],
    delete: async (key: string) => contents.delete(key),
    open: async (key: string) => {
      if (!contents.has(key)) contents.set(key, new Map());
      const cache = contents.get(key)!;
      return {
        addAll: async (urls: string[]) => {
          if (failInstall) throw new Error('offline');
          for (const url of urls) cache.set(url, new Response(url));
        },
        match: async (request: string | { url: string }) =>
          cache.get(typeof request === 'string' ? request : new URL(request.url).pathname)?.clone(),
      };
    },
  };
  runInNewContext(source, {
    self: {
      addEventListener: (type: string, fn: (event: any) => void) => (handlers[type] = fn),
      skipWaiting,
      clients: { claim },
      location: { origin: 'https://example.test' },
    },
    caches,
    fetch,
    URL,
    Response,
  });
  async function dispatch(type: string, data = {}) {
    let pending: Promise<unknown> | undefined;
    handlers[type]({
      ...data,
      waitUntil: (value: Promise<unknown>) => (pending = value),
      respondWith: (value: Promise<unknown>) => (pending = value),
    });
    return pending;
  }
  return { paths, prefix, name, contents, skipWaiting, claim, fetch, dispatch };
}
describe.each(['/', '/okusuri-check/'])('公開先 %s のオフライン用Service Worker', (base) => {
  it('正しい公開先の静的ファイルをすべて保存して有効化', async () => {
    const f = fixture(base);
    await f.dispatch('install');
    expect([...f.contents.get(f.name)!.keys()]).toEqual(f.paths);
    expect(f.skipWaiting).toHaveBeenCalledOnce();
  });
  it('初回のキャッシュに失敗した場合は準備完了にしない', async () => {
    const f = fixture(base, true);
    await expect(f.dispatch('install')).rejects.toThrow('offline');
    expect(f.skipWaiting).not.toHaveBeenCalled();
  });
  it('更新時は同じ公開先の古いキャッシュだけ削除', async () => {
    const f = fixture(base);
    f.contents.set(`${f.prefix}old`, new Map());
    f.contents.set('okusuri-shell-another-project-test', new Map());
    f.contents.set('other-app', new Map());
    await f.dispatch('install');
    await f.dispatch('activate');
    expect(f.contents.has(`${f.prefix}old`)).toBe(false);
    expect(f.contents.has('okusuri-shell-another-project-test')).toBe(true);
    expect(f.contents.has('other-app')).toBe(true);
    expect(f.contents.has(f.name)).toBe(true);
    expect(f.claim).toHaveBeenCalledOnce();
  });
  it('オフラインで公開先のHTMLへ復元する', async () => {
    const f = fixture(base);
    await f.dispatch('install');
    const response = (await f.dispatch('fetch', {
      request: { url: `https://example.test${base}?from=home`, method: 'GET', mode: 'navigate' },
    })) as Response;
    expect(await response.text()).toBe(`${base}index.html`);
  });
  it('JS/CSSは自分のキャッシュから読み、外部URLは処理しない', async () => {
    const f = fixture(base);
    await f.dispatch('install');
    const response = (await f.dispatch('fetch', {
      request: { url: `https://example.test${base}assets/app.js`, method: 'GET', mode: 'cors' },
    })) as Response;
    expect(await response.text()).toBe(`${base}assets/app.js`);
    expect(
      await f.dispatch('fetch', {
        request: { url: 'https://external.test/', method: 'GET', mode: 'cors' },
      }),
    ).toBeUndefined();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it('現在の画面の資産が揃わない場合は準備完了にしない', async () => {
    const f = fixture(base);
    await f.dispatch('install');
    const postMessage = vi.fn();
    await f.dispatch('message', {
      data: { type: 'okusuri:offline-status', paths: [`${base}assets/app.js`] },
      ports: [{ postMessage }],
    });
    expect(postMessage).toHaveBeenLastCalledWith({ ready: true });
    await f.dispatch('message', {
      data: { type: 'okusuri:offline-status', paths: [`${base}assets/old.js`] },
      ports: [{ postMessage }],
    });
    expect(postMessage).toHaveBeenLastCalledWith({ ready: false });
    f.contents.get(f.name)!.delete(`${base}assets/app.js`);
    await f.dispatch('message', {
      data: { type: 'okusuri:offline-status', paths: [`${base}assets/app.js`] },
      ports: [{ postMessage }],
    });
    expect(postMessage).toHaveBeenLastCalledWith({ ready: false });
  });
});
it('別のリポジトリへの移動にこのアプリのHTMLを返さない', async () => {
  const f = fixture('/okusuri-check/');
  await f.dispatch('install');
  expect(
    await f.dispatch('fetch', {
      request: { url: 'https://example.test/other-project/', method: 'GET', mode: 'navigate' },
    }),
  ).toBeUndefined();
  expect(f.fetch).not.toHaveBeenCalled();
});
