import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applySettings,
  defaultSettings,
  makeDay,
  status,
  tokyoDate,
  validDate,
  validateSettings,
} from '../shared/domain';
const now = Date.parse('2026-10-17T07:00:00+09:00');
const fresh = () => makeDay(tokyoDate(now), structuredClone(defaultSettings), now);
describe('朝の点鼻・夜間尿量', () => {
  it.each([
    [109, 'excluded'],
    [110, 'pending'],
    [null, 'waiting'],
    [0, 'excluded'],
  ] as const)('%s g → %s', (urine, expected) => {
    const day = fresh();
    day.urine = urine;
    expect(status(day.items[1], day)).toBe(expected);
  });
  it.each([null, 109])('確認待ち・対象外を実施済みにできない (%s)', (urine) => {
    const day = fresh();
    day.urine = urine;
    expect(() =>
      applyAction(day, { type: 'complete', itemId: 'morning-nasal', revision: 0 }, now),
    ).toThrow();
  });
  it.each([-1, NaN, Infinity, 10001, undefined])('不正な尿量 %s を拒否', (value) => {
    expect(() => applyAction(fresh(), { type: 'urine', revision: 0, value }, now)).toThrow();
  });
  it('尿量の訂正前後を保存し、実施済み時刻を消さない', () => {
    let day = applyAction(fresh(), { type: 'urine', value: 110, revision: 0 }, now);
    day = applyAction(day, { type: 'complete', itemId: 'morning-nasal', revision: 0 }, now + 1);
    day = applyAction(day, { type: 'urine', value: 109, revision: 1 }, now + 2);
    expect(day.urine).toBe(109);
    expect(status(day.items[1], day)).toBe('done');
    expect(day.items[1].completedAt).toBe(now + 1);
    expect(day.events.at(-1)).toMatchObject({ type: 'urine', before: 110, after: 109 });
  });
  it('古いタブの尿量変更を拒否', () => {
    const day = applyAction(fresh(), { type: 'urine', value: 110, revision: 0 }, now);
    expect(() => applyAction(day, { type: 'urine', value: 109, revision: 0 }, now)).toThrow();
  });
});
describe('実施と訂正', () => {
  it('実施時刻を自動保存、同じ実施操作の重複を防ぐ', () => {
    const day = applyAction(
      fresh(),
      { type: 'complete', itemId: 'morning-gastro', revision: 0 },
      now,
    );
    const again = applyAction(
      day,
      { type: 'complete', itemId: 'morning-gastro', revision: 0 },
      now + 1,
    );
    expect(again).toBe(day);
    expect(day.items[0].completedAt).toBe(now);
    expect(day.events).toHaveLength(1);
  });
  it('訂正で元記録・理由・訂正日時を保持し、古い実施要求を拒否', () => {
    const original = applyAction(
      fresh(),
      { type: 'complete', itemId: 'morning-gastro', revision: 0 },
      now,
    );
    const corrected = applyAction(
      original,
      { type: 'correct', itemId: 'morning-gastro', revision: 1, reason: '誤タップ' },
      now + 1000,
    );
    expect(corrected.items[0].completedAt).toBeNull();
    expect(corrected.events.at(-1)).toMatchObject({
      type: 'correct',
      before: { completedAt: now },
      reason: '誤タップ',
      at: now + 1000,
    });
    expect(() =>
      applyAction(
        corrected,
        { type: 'complete', itemId: 'morning-gastro', revision: 0 },
        now + 2000,
      ),
    ).toThrow();
    expect(original.items[0].completedAt).toBe(now);
  });
  it.each(['', '   ', 'a'.repeat(301)])('理由のない訂正・長すぎる理由を拒否', (reason) => {
    const day = applyAction(
      fresh(),
      { type: 'complete', itemId: 'morning-gastro', revision: 0 },
      now,
    );
    expect(() =>
      applyAction(day, { type: 'correct', itemId: 'morning-gastro', revision: 1, reason }, now),
    ).toThrow();
  });
  it('朝夕の胃ろうは独立、昼の項目なし', () => {
    const day = applyAction(
      fresh(),
      { type: 'complete', itemId: 'morning-gastro', revision: 0 },
      now,
    );
    expect(day.items.find((i) => i.id === 'evening-gastro')?.completedAt).toBeNull();
    expect(day.items.every((i) => ['morning', 'evening'].includes(i.period))).toBe(true);
    expect(day.items).toHaveLength(7);
  });
});
describe('日付と一時薬', () => {
  it('日本時間0時を境に日付が変わる', () => {
    const midnight = Date.parse('2026-10-18T00:00:00+09:00');
    expect(tokyoDate(midnight - 1)).toBe('2026-10-17');
    expect(tokyoDate(midnight)).toBe('2026-10-18');
  });
  it('前日のダイアログからの保存を拒否', () => {
    expect(() =>
      applyAction(
        fresh(),
        { type: 'complete', itemId: 'morning-gastro', revision: 0 },
        now + 86400000,
      ),
    ).toThrow();
  });
  it('日付を検証し不正な日付を拒否', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2026-10-17')).toBe(true);
  });
  it('一時薬を終了しても実施済み時刻は保持、未実施だけ対象外', () => {
    const day = applyAction(fresh(), { type: 'complete', itemId: 'evening-eye', revision: 0 }, now);
    const settings = structuredClone(defaultSettings);
    settings.version++;
    settings.medicines.filter((m) => m.temporary).forEach((m) => (m.enabled = false));
    const next = applySettings(day, settings, now + 1);
    expect(next.items.find((i) => i.id === 'evening-eye')?.completedAt).toBe(now);
    expect(
      status(
        next.items.find((i) => i.id === 'evening-ent')!,
        next,
      ),
    ).toBe('excluded');
    expect(next.events.at(-1)?.type).toBe('temporary-settings');
    expect(day.items.find((i) => i.id === 'evening-ent')?.enabled).toBe(true);
  });
  it('終了設定は翌日も維持、再開すると未実施へ', () => {
    const settings = structuredClone(defaultSettings);
    settings.medicines.find((m) => m.id === 'evening-eye')!.enabled = false;
    const day = makeDay('2026-10-18', settings, now + 86400000);
    const item = day.items.find((i) => i.id === 'evening-eye')!;
    expect(status(item, day)).toBe('excluded');
    const next = applySettings(day, defaultSettings, now + 86400000 + 1);
    expect(
      status(
        next.items.find((i) => i.id === 'evening-eye')!,
        next,
      ),
    ).toBe('pending');
  });
  it('固定の薬や110gの指示条件の不正な変更を拒否', () => {
    expect(() => validateSettings({ ...defaultSettings, threshold: 100 })).toThrow();
    const settings = structuredClone(defaultSettings);
    settings.medicines[0].enabled = false;
    expect(() => validateSettings(settings)).toThrow();
  });
});
