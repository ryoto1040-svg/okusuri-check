export type Period = 'morning' | 'evening';
export type Status = 'pending' | 'done' | 'waiting' | 'excluded';
export interface Medicine {
  id: string;
  name: string;
  period: Period;
  temporary: boolean;
  enabled: boolean;
  conditional: boolean;
}
export interface Settings {
  version: number;
  threshold: number;
  medicines: Medicine[];
}
export interface Item extends Medicine {
  completedAt: number | null;
  revision: number;
}
export type AuditEvent =
  | {
      id: string;
      type: 'complete' | 'correct';
      itemId: string;
      name: string;
      period: Period;
      before: Item;
      after: Item;
      reason: string | null;
      at: number;
    }
  | { id: string; type: 'urine'; before: number | null; after: number | null; at: number }
  | { id: string; type: 'temporary-settings'; before: Item[]; after: Item[]; at: number };
export interface Day {
  date: string;
  settingsVersion: number;
  threshold: number;
  urine: number | null;
  urineRevision: number;
  items: Item[];
  events: AuditEvent[];
  createdAt: number;
  updatedAt: number;
}
export interface Action {
  type: 'complete' | 'correct' | 'urine';
  itemId?: string;
  revision: number;
  value?: number | null;
  reason?: string;
}
export const labels: Record<Status, string> = {
  pending: '未実施',
  done: '実施済み',
  waiting: '確認待ち',
  excluded: '対象外',
};
export const defaultSettings: Settings = {
  version: 1,
  threshold: 110,
  medicines: [
    {
      id: 'morning-gastro',
      name: '胃ろうからの薬',
      period: 'morning',
      temporary: false,
      enabled: true,
      conditional: false,
    },
    {
      id: 'morning-nasal',
      name: '点鼻',
      period: 'morning',
      temporary: false,
      enabled: true,
      conditional: true,
    },
    {
      id: 'evening-gastro',
      name: '胃ろうからの薬',
      period: 'evening',
      temporary: false,
      enabled: true,
      conditional: false,
    },
    {
      id: 'evening-sleep',
      name: '眠剤',
      period: 'evening',
      temporary: false,
      enabled: true,
      conditional: false,
    },
    {
      id: 'evening-nasal',
      name: '点鼻',
      period: 'evening',
      temporary: false,
      enabled: true,
      conditional: false,
    },
    {
      id: 'evening-ent',
      name: '耳鼻科の鼻の薬',
      period: 'evening',
      temporary: true,
      enabled: true,
      conditional: false,
    },
    {
      id: 'evening-eye',
      name: '点眼',
      period: 'evening',
      temporary: true,
      enabled: true,
      conditional: false,
    },
  ],
};
export class DomainError extends Error {}
export function tokyoDate(now = Date.now()): string {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10);
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T12:00:00+09:00`);
  return Number.isFinite(parsed) && tokyoDate(parsed) === value;
}
export function makeDay(date: string, settings: Settings, now: number): Day {
  return {
    date,
    settingsVersion: settings.version,
    threshold: settings.threshold,
    urine: null,
    urineRevision: 0,
    // 無効な一時薬も対象外として保持し、当日の再開と設定履歴に対応する。
    items: settings.medicines.map((m) => ({ ...m, completedAt: null, revision: 0 })),
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function status(item: Item, day: Day): Status {
  if (item.completedAt !== null) return 'done';
  if (!item.enabled) return 'excluded';
  if (item.conditional)
    return day.urine === null ? 'waiting' : day.urine >= day.threshold ? 'pending' : 'excluded';
  return 'pending';
}
function eventId(day: Day, now: number): string {
  return `${now}-${day.events.length}`;
}
export function applyAction(day: Day, action: Action, now: number): Day {
  if (day.date !== tokyoDate(now))
    throw new DomainError('日付が変わりました。今日の画面で状態を確認してください。');
  if (!Number.isSafeInteger(action.revision) || action.revision < 0)
    throw new DomainError('操作をやり直してください。');
  const next = structuredClone(day);
  if (action.type === 'urine') {
    if (action.revision !== day.urineRevision)
      throw new DomainError('尿量が別のタブで変更されました。最新の値を確認してください。');
    if (
      action.value !== null &&
      (typeof action.value !== 'number' ||
        !Number.isFinite(action.value) ||
        action.value < 0 ||
        action.value > 10000)
    )
      throw new DomainError('尿量は0〜10000gで入力してください。');
    if (action.value === day.urine) return day;
    next.urine = action.value!;
    next.urineRevision++;
    next.events.push({
      id: eventId(day, now),
      type: 'urine',
      before: day.urine,
      after: next.urine,
      at: now,
    });
  } else {
    const item = next.items.find((i) => i.id === action.itemId);
    if (!item) throw new DomainError('この項目は見つかりません。');
    if (action.type === 'complete' && item.completedAt !== null) return day;
    if (action.revision !== item.revision)
      throw new DomainError('記録が別のタブで変更されました。最新の状態を確認してください。');
    const before = { ...item };
    if (action.type === 'complete') {
      if (status(item, next) !== 'pending')
        throw new DomainError('確認待ち・対象外の項目は実施済みにできません。');
      item.completedAt = now;
    } else if (action.type === 'correct') {
      if (item.completedAt === null || !action.reason?.trim() || action.reason.length > 300)
        throw new DomainError('訂正理由を1〜300文字で入力してください。');
      item.completedAt = null;
    } else throw new DomainError('操作が不正です。');
    item.revision++;
    next.events.push({
      id: eventId(day, now),
      type: action.type,
      itemId: item.id,
      name: item.name,
      period: item.period,
      before,
      after: { ...item },
      reason: action.type === 'correct' ? action.reason!.trim() : null,
      at: now,
    });
  }
  next.updatedAt = now;
  return next;
}
export function validateMedicines(value: unknown): Medicine[] {
  if (!Array.isArray(value) || value.length !== defaultSettings.medicines.length)
    throw new DomainError('薬の設定が不正です。');
  return defaultSettings.medicines.map((template) => {
    const matches = value.filter((m) => m && m.id === template.id),
      med = matches[0] as Medicine | undefined;
    if (
      matches.length !== 1 ||
      !med ||
      med.name !== template.name ||
      med.period !== template.period ||
      med.temporary !== template.temporary ||
      med.conditional !== template.conditional ||
      typeof med.enabled !== 'boolean' ||
      (!med.temporary && !med.enabled)
    )
      throw new DomainError('薬の設定が不正です。');
    return { ...template, enabled: med.enabled };
  });
}
export function validateSettings(value: unknown): Settings {
  const s = value as Settings;
  if (!s || !Number.isSafeInteger(s.version) || s.version < 1 || s.threshold !== 110)
    throw new DomainError('設定データが不正です。');
  return { version: s.version, threshold: 110, medicines: validateMedicines(s.medicines) };
}
export function applySettings(day: Day, settings: Settings, now: number): Day {
  const next = structuredClone(day);
  for (const item of next.items) {
    const med = settings.medicines.find((m) => m.id === item.id)!;
    if (item.temporary && item.enabled !== med.enabled) {
      item.enabled = med.enabled;
      item.revision++;
    }
  }
  if (JSON.stringify(day.items) === JSON.stringify(next.items)) return day;
  next.events.push({
    id: eventId(day, now),
    type: 'temporary-settings',
    before: structuredClone(day.items),
    after: structuredClone(next.items),
    at: now,
  });
  next.settingsVersion = settings.version;
  next.updatedAt = now;
  return next;
}
