import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const key = 'okusuri-check.local.v1';
const firstRow = (page: Page) => page.locator('.morning .medicine-row').first();
async function open(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '今日のお薬', exact: true })).toBeVisible();
}
async function complete(page: Page) {
  await firstRow(page).getByRole('button', { name: '実施を記録' }).click();
  await page.getByRole('button', { name: '投与したことを確認して記録' }).click();
  await expect(firstRow(page)).toContainText('実施済み');
}
async function correct(page: Page) {
  await firstRow(page).getByRole('button', { name: '訂正', exact: true }).click();
  await page.getByLabel('訂正理由').fill('誤タップの訂正');
  await page.getByRole('button', { name: '訂正して未実施に戻す' }).click();
  await expect(firstRow(page)).toContainText('未実施');
}
test('ログイン不要、確認付きの実施・尿量・再読込・訂正履歴、外部通信なし', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [],
    errors: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await expect(page.getByText('記録はこの端末・このブラウザだけに保存されます。')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toHaveCount(0);
  await expect(page.locator('.morning .medicine-row.waiting')).toContainText('確認待ち');
  await firstRow(page).getByRole('button', { name: '実施を記録' }).click();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(firstRow(page)).toContainText('未実施');
  await complete(page);
  await firstRow(page).locator('h3').click();
  await expect(firstRow(page)).toContainText('実施済み');
  await page.getByLabel('夜間尿量', { exact: true }).fill('110');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('点鼻が必要な条件', { exact: true })).toBeVisible();
  await page.reload();
  await expect(firstRow(page)).toContainText('実施済み');
  await expect(page.getByLabel('夜間尿量', { exact: true })).toHaveValue('110');
  await page.getByLabel('夜間尿量', { exact: true }).fill('109');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await expect(page.locator('.morning .medicine-row.excluded')).toContainText('対象外');
  await page.screenshot({ path: 'test-results/mobile-local.png', fullPage: true });
  await correct(page);
  await page.locator('.bottom-nav').getByRole('button', { name: '履歴', exact: true }).click();
  await expect(page.getByText('訂正理由：誤タップの訂正')).toBeVisible();
  await expect(page.getByText('元の実施時刻：', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests.filter((url) => new URL(url).origin !== 'http://127.0.0.1:4173')).toEqual([]);
  expect(errors).toEqual([]);
});
test('異なる端末相当のブラウザではデータが独立', async ({ browser }) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const first = await a.newPage(),
      second = await b.newPage();
    await open(first);
    await complete(first);
    await open(second);
    await expect(firstRow(second)).toContainText('未実施');
    expect(
      await second.evaluate((key) => JSON.parse(localStorage.getItem(key)!).days, key),
    ).not.toEqual(await first.evaluate((key) => JSON.parse(localStorage.getItem(key)!).days, key));
  } finally {
    await a.close();
    await b.close();
  }
});
test('同じブラウザの2タブで同時操作しても実施イベントは1件', async ({ page, context }) => {
  const other = await context.newPage();
  await open(page);
  await open(other);
  await firstRow(page).getByRole('button', { name: '実施を記録' }).click();
  await firstRow(other).getByRole('button', { name: '実施を記録' }).click();
  await Promise.all([
    page.getByRole('button', { name: '投与したことを確認して記録' }).click(),
    other.getByRole('button', { name: '投与したことを確認して記録' }).click(),
  ]);
  await expect(firstRow(page)).toContainText('実施済み');
  await expect(firstRow(other)).toContainText('実施済み');
  expect(
    await page.evaluate(
      (key) =>
        Object.values(JSON.parse(localStorage.getItem(key)!).days)
          .flatMap((d: any) => d.events)
          .filter((e: any) => e.type === 'complete').length,
      key,
    ),
  ).toBe(1);
});
test('PWAが通信なしで再起動し、オフラインでも記録できる', async ({ page, context }) => {
  await open(page);
  await expect(page.getByText('オフライン利用の準備ができています')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '今日のお薬', exact: true })).toBeVisible();
  await complete(page);
  await page.reload();
  await expect(firstRow(page)).toContainText('実施済み');
  await page.getByLabel('夜間尿量', { exact: true }).fill('0');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.morning .medicine-row.excluded')).toContainText('対象外');
  await context.setOffline(false);
  const manifest = await page.request.get('./manifest.webmanifest');
  expect((await manifest.json()).display).toBe('standalone');
});
test('オフラインで0時をまたいでも新日へ切替、前日の記録とダイアログ保護', async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date('2026-10-17T23:59:59+09:00') });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await complete(page);
  await page
    .locator('.evening .medicine-row')
    .first()
    .getByRole('button', { name: '実施を記録' })
    .click();
  await context.setOffline(true);
  await page.clock.fastForward(2000);
  await expect(page.locator('.date-tile strong')).toHaveText('18');
  await expect(page.getByRole('button', { name: '投与したことを確認して記録' })).toBeDisabled();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(firstRow(page)).toContainText('未実施');
  await page.locator('.bottom-nav').getByRole('button', { name: '履歴', exact: true }).click();
  await page.getByLabel('確認する日付').fill('2026-10-17');
  await expect(
    page.locator('.history-period').first().locator('.history-row').first(),
  ).toContainText('実施済み');
  await context.setOffline(false);
});
test('一時薬の終了は当日と翌日に反映し、過去は保持', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T12:00:00+09:00') });
  await page.setViewportSize({ width: 1280, height: 960 });
  await open(page);
  await page.screenshot({ path: 'test-results/desktop-local.png', fullPage: true });
  await page.locator('.sidebar').getByRole('button', { name: '設定', exact: true }).click();
  const row = page.locator('.temporary-editor').filter({ hasText: '耳鼻科の鼻の薬' });
  await row.getByLabel('有効', { exact: true }).uncheck();
  await page.getByRole('button', { name: '変更を保存', exact: true }).click();
  await page.getByRole('button', { name: '設定を保存', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: '今日のお薬', exact: true }).click();
  await expect(page.locator('.medicine-row').filter({ hasText: '耳鼻科の鼻の薬' })).toContainText(
    '対象外',
  );
  await page.clock.fastForward(86400000);
  await expect(page.locator('.date-tile strong')).toHaveText('18');
  await expect(page.locator('.medicine-row').filter({ hasText: '耳鼻科の鼻の薬' })).toContainText(
    '対象外',
  );
  const days = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).days, key);
  expect(days['2026-10-17'].events.some((e: any) => e.type === 'temporary-settings')).toBe(true);
});
test('保存エラー時に実施済みと表示しない', async ({ page }) => {
  await open(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('full', 'QuotaExceededError');
      original.call(this, name, value);
    };
  }, key);
  await firstRow(page).getByRole('button', { name: '実施を記録' }).click();
  await page.getByRole('button', { name: '投与したことを確認して記録' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('保存できませんでした');
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(firstRow(page)).toContainText('未実施');
});
test('バックアップを保存・確認付き復元、破損データは上書きしない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await open(page);
  await complete(page);
  await page.locator('.sidebar').getByRole('button', { name: '設定', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'バックアップを保存', exact: true }).click();
  const download = await downloadPromise;
  const text = await readFile((await download.path())!, 'utf8');
  await page.locator('.sidebar').getByRole('button', { name: '今日のお薬', exact: true }).click();
  await correct(page);
  await page.locator('.sidebar').getByRole('button', { name: '設定', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(page.getByRole('dialog')).toContainText('現在の記録全体を置き換えます');
  await page.getByRole('button', { name: '現在の記録を置き換えて復元' }).click();
  await page.locator('.sidebar').getByRole('button', { name: '今日のお薬', exact: true }).click();
  await expect(firstRow(page)).toContainText('実施済み');
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('上書きしていません');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe('{broken');
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await page.getByRole('button', { name: '現在の記録を置き換えて復元' }).click();
  await expect(firstRow(page)).toContainText('実施済み');
});
