import { beforeEach, describe, expect, it } from 'vitest';
import { LocalRepository, STORAGE_KEY, parseBackup, type StoragePort } from '../src/localStore';
import { defaultSettings, status, tokyoDate } from '../shared/domain';
class MemoryStorage implements StoragePort {
  data = new Map<string, string>();
  fail = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
}
let storage: MemoryStorage, repo: LocalRepository, now: number;
beforeEach(() => {
  storage = new MemoryStorage();
  now = Date.parse('2026-10-17T07:00:00+09:00');
  repo = new LocalRepository(storage, () => now);
});
describe('localStorageの原子的な保存', () => {
  it('初回作成と再読込で実施・尿量・履歴を復元', async () => {
    await repo.refresh();
    await repo.record(tokyoDate(now), { type: 'urine', value: 110, revision: 0 });
    await repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 });
    const next = await new LocalRepository(storage, () => now).refresh();
    expect(next.days[tokyoDate(now)].urine).toBe(110);
    expect(next.days[tokyoDate(now)].items[0].completedAt).toBe(now);
    expect(next.days[tokyoDate(now)].events).toHaveLength(2);
  });
  it('容量不足の保存は失敗し、元の記録を未実施のまま保持', async () => {
    await repo.refresh();
    const before = repo.raw();
    storage.fail = true;
    await expect(
      repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 }),
    ).rejects.toThrow('保存できません');
    expect(repo.raw()).toBe(before);
    expect(repo.read()?.days[tokyoDate(now)].items[0].completedAt).toBeNull();
  });
  it('初回の保存拒否も成功扱いにしない', async () => {
    storage.fail = true;
    await expect(repo.refresh()).rejects.toThrow();
    expect(repo.raw()).toBeNull();
  });
  it('破損したJSONを自動初期化しない', async () => {
    storage.setItem(STORAGE_KEY, '{broken');
    await expect(repo.refresh()).rejects.toThrow('上書きしていません');
    expect(repo.raw()).toBe('{broken');
  });
  it('構造が不正な記録を自動初期化しない', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, days: {} }));
    const raw = repo.raw();
    await expect(repo.refresh()).rejects.toThrow();
    expect(repo.raw()).toBe(raw);
  });
  it('別の保存領域（端末）では記録が独立', async () => {
    await repo.refresh();
    await repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 });
    const other = await new LocalRepository(new MemoryStorage(), () => now).refresh();
    expect(other.days[tokyoDate(now)].items[0].completedAt).toBeNull();
  });
  it('同じ保存領域から毎回最新データを読み、別項目を上書きしない', async () => {
    await repo.refresh();
    const other = new LocalRepository(storage, () => now);
    await Promise.all([
      repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 }),
      other.record(tokyoDate(now), { type: 'complete', itemId: 'evening-gastro', revision: 0 }),
    ]);
    const day = repo.read()!.days[tokyoDate(now)];
    expect(day.items.filter((i) => i.completedAt !== null)).toHaveLength(2);
    expect(day.events).toHaveLength(2);
  });
  it('同時実施要求でも同じ実施イベントは1つ', async () => {
    await repo.refresh();
    await Promise.all([
      repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 }),
      repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 }),
    ]);
    expect(repo.read()!.days[tokyoDate(now)].events).toHaveLength(1);
  });
  it('0時・数日後の再開でも過去を保持し、新日へチェックを持ち越さない', async () => {
    await repo.refresh();
    await repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 });
    const old = repo.read()!.days[tokyoDate(now)];
    now = Date.parse('2026-10-18T00:00:00+09:00');
    let state = await repo.refresh();
    expect(state.days['2026-10-17']).toEqual(old);
    expect(state.days['2026-10-18'].items.every((i) => i.completedAt === null)).toBe(true);
    now += 3 * 86400000;
    state = await repo.refresh();
    expect(state.days['2026-10-17']).toEqual(old);
    expect(state.days['2026-10-21']).toBeDefined();
  });
  it('終了設定は当日と翌日に反映、前日は不変', async () => {
    await repo.refresh();
    const old = repo.read()!.days[tokyoDate(now)];
    now += 86400000;
    await repo.refresh();
    const settings = structuredClone(defaultSettings);
    settings.medicines.filter((m) => m.temporary).forEach((m) => (m.enabled = false));
    let state = await repo.saveSettings(settings, tokyoDate(now));
    expect(state.days['2026-10-17']).toEqual(old);
    const day = state.days[tokyoDate(now)];
    expect(
      status(
        day.items.find((i) => i.id === 'evening-eye')!,
        day,
      ),
    ).toBe('excluded');
    now += 86400000;
    state = await repo.refresh();
    expect(state.days[tokyoDate(now)].items.find((i) => i.id === 'evening-eye')?.enabled).toBe(
      false,
    );
  });
  it('古い設定画面からの上書きを拒否', async () => {
    await repo.refresh();
    const settings = structuredClone(defaultSettings);
    settings.medicines.find((m) => m.id === 'evening-eye')!.enabled = false;
    await repo.saveSettings(settings, tokyoDate(now));
    await expect(repo.saveSettings(defaultSettings, tokyoDate(now))).rejects.toThrow('別のタブ');
  });
});
describe('バックアップと復元', () => {
  it('訂正履歴ごと復元できる', async () => {
    await repo.refresh();
    await repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 });
    now += 1000;
    await repo.record(tokyoDate(now), {
      type: 'correct',
      itemId: 'morning-gastro',
      revision: 1,
      reason: '誤タップ',
    });
    const text = repo.exportBackup();
    const original = repo.read()!;
    const other = new LocalRepository(new MemoryStorage(), () => now);
    const restored = await other.restore(text, null);
    expect(restored.days).toEqual(original.days);
    expect(restored.days[tokyoDate(now)].events[1]).toMatchObject({
      type: 'correct',
      reason: '誤タップ',
      before: { completedAt: now - 1000 },
    });
  });
  it('確認中に記録が変更された場合、復元で消さない', async () => {
    await repo.refresh();
    const text = repo.exportBackup(),
      raw = repo.raw();
    await repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 });
    await expect(repo.restore(text, raw)).rejects.toThrow('確認中');
    expect(repo.read()!.days[tokyoDate(now)].items[0].completedAt).toBe(now);
  });
  it('明示的な復元で破損データを復旧できる', async () => {
    await repo.refresh();
    const text = repo.exportBackup();
    storage.setItem(STORAGE_KEY, 'broken');
    await repo.restore(text, 'broken');
    expect(repo.read()!.days[tokyoDate(now)]).toBeDefined();
  });
  it.each(['{}', '[]', '{bad', 'null', '{"format":"okusuri-check-backup","data":null}'])(
    '不正なファイルを拒否: %s',
    (text) => {
      expect(() => parseBackup(text)).toThrow();
    },
  );
  it('壊れた訂正履歴を含むバックアップを拒否', async () => {
    await repo.refresh();
    await repo.record(tokyoDate(now), { type: 'complete', itemId: 'morning-gastro', revision: 0 });
    const data = JSON.parse(repo.exportBackup());
    data.data.days[tokyoDate(now)].events[0].after.completedAt = 'invalid';
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
  });
});
