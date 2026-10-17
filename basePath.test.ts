import { describe, expect, it } from 'vitest';
import { normalizeBasePath } from '../shared/basePath';
describe('GitHub Pagesのbaseパス', () => {
  it.each([
    ['', '/'],
    ['/', '/'],
    ['/okusuri-check', '/okusuri-check/'],
    ['okusuri-check', '/okusuri-check/'],
    ['/okusuri-check/', '/okusuri-check/'],
    ['/nested/app/', '/nested/app/'],
  ])('%s → %s', (input, expected) => expect(normalizeBasePath(input)).toBe(expected));
  it.each(['/../', '/./', 'https://example.com/', '/app?x=1/', '/app#x/'])(
    'パス以外や親ディレクトリを拒否: %s',
    (input) => expect(() => normalizeBasePath(input)).toThrow(),
  );
});
