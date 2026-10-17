// localhost接続が制限される環境向けの補助確認。PWAのHTTP検証の代わりにはしない。
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
await mkdir('.tools/ui-check', { recursive: true });
await build({
  entryPoints: ['src/main.tsx'],
  outfile: '.tools/ui-check/app.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  define: {
    'import.meta.env': JSON.stringify({ DEV: true, PROD: false }),
    'process.env.NODE_ENV': '"production"',
  },
});
const script = await readFile('.tools/ui-check/app.js', 'utf8');
const css = await readFile('.tools/ui-check/app.css', 'utf8');
await writeFile(
  '.tools/ui-check/index.html',
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`,
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined),
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  context.on('request', (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await page.goto(pathToFileURL(resolve('.tools/ui-check/index.html')).href);
  await expect(page.getByRole('heading', { name: '今日のお薬', exact: true })).toBeVisible();
  await expect(page.getByText('記録はこの端末・このブラウザだけに保存されます。')).toBeVisible();
  const row = page.locator('.morning .medicine-row').first();
  await row.getByRole('button', { name: '実施を記録' }).click();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(row).toContainText('未実施');
  await row.getByRole('button', { name: '実施を記録' }).click();
  await page.getByRole('button', { name: '投与したことを確認して記録' }).click();
  await expect(row).toContainText('実施済み');
  await page.getByLabel('夜間尿量', { exact: true }).fill('110');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('点鼻が必要な条件', { exact: true })).toBeVisible();
  await page.reload();
  await expect(row).toContainText('実施済み');
  await expect(page.getByLabel('夜間尿量', { exact: true })).toHaveValue('110');
  await page.screenshot({ path: '.tools/ui-check/mobile.png', fullPage: true });
  await row.getByRole('button', { name: '訂正', exact: true }).click();
  await page.getByLabel('訂正理由').fill('確認用の訂正');
  await page.getByRole('button', { name: '訂正して未実施に戻す' }).click();
  await expect(row).toContainText('未実施');
  await page.locator('.bottom-nav').getByRole('button', { name: '履歴', exact: true }).click();
  await expect(page.getByText('訂正理由：確認用の訂正')).toBeVisible();
  await page.locator('.bottom-nav').getByRole('button', { name: '設定', exact: true }).click();
  await page
    .locator('.temporary-editor')
    .filter({ hasText: '耳鼻科の鼻の薬' })
    .getByLabel('有効', { exact: true })
    .uncheck();
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await page.getByRole('button', { name: '設定を保存', exact: true }).click();
  await page.locator('.bottom-nav').getByRole('button', { name: '今日', exact: true }).click();
  await expect(page.locator('.medicine-row').filter({ hasText: '耳鼻科の鼻の薬' })).toContainText(
    '対象外',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.tools/ui-check/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  console.log(
    'File-based Chrome UI check passed: confirmation, save/reload, urine, correction history, temporary settings, mobile/desktop, no external requests. HTTP/PWA checks remain separate.',
  );
} finally {
  await browser.close();
}
