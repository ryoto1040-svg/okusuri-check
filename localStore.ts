import {
  applyAction,
  applySettings,
  defaultSettings,
  DomainError,
  makeDay,
  tokyoDate,
  validDate,
  validateMedicines,
  validateSettings,
  type Action,
  type AuditEvent,
  type Day,
  type Item,
  type Settings,
} from '../shared/domain';
export const STORAGE_KEY = 'okusuri-check.local.v1';
export interface LocalState {
  schemaVersion: 1;
  revision: number;
  settings: Settings;
  days: Record<string, Day>;
}
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
type Exclusive = <T>(task: () => T) => Promise<T>;
const nonnegativeInt = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const timestamp = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v < 8640000000000000;
const urine = (v: unknown): v is number | null =>
  v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000);
const invalid = () =>
  new DomainError(
    '保存データを読み取れません。元のデータは上書きしていません。バックアップを保存してから確認してください。',
  );
function validateItems(value: unknown): asserts value is Item[] {
  validateMedicines(value);
  if (
    !(value as Item[]).every(
      (i) => nonnegativeInt(i.revision) && (i.completedAt === null || timestamp(i.completedAt)),
    )
  )
    throw invalid();
}
function validateEvents(value: unknown): asserts value is AuditEvent[] {
  if (!Array.isArray(value)) throw invalid();
  const ids = new Set<string>();
  for (const e of value as AuditEvent[]) {
    if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id) || !timestamp(e.at))
      throw invalid();
    ids.add(e.id);
    if (e.type === 'urine') {
      if (!urine(e.before) || !urine(e.after)) throw invalid();
    } else if (e.type === 'temporary-settings') {
      validateItems(e.before);
      validateItems(e.after);
    } else if (e.type === 'complete' || e.type === 'correct') {
      const med = defaultSettings.medicines.find((m) => m.id === e.itemId);
      if (
        !med ||
        e.name !== med.name ||
        e.period !== med.period ||
        !e.before ||
        !e.after ||
        e.before.id !== med.id ||
        e.after.id !== med.id ||
        !nonnegativeInt(e.before.revision) ||
        !nonnegativeInt(e.after.revision) ||
        !(e.before.completedAt === null || timestamp(e.before.completedAt)) ||
        !(e.after.completedAt === null || timestamp(e.after.completedAt))
      )
        throw invalid();
      if (
        e.type === 'correct' &&
        (typeof e.reason !== 'string' ||
          !e.reason.trim() ||
          e.reason.length > 300 ||
          !timestamp(e.before.completedAt) ||
          e.after.completedAt !== null)
      )
        throw invalid();
      if (
        e.type === 'complete' &&
        (e.before.completedAt !== null || !timestamp(e.after.completedAt))
      )
        throw invalid();
    } else throw invalid();
  }
}
export function validateState(value: unknown): LocalState {
  const state = value as LocalState;
  if (
    !state ||
    state.schemaVersion !== 1 ||
    !nonnegativeInt(state.revision) ||
    !state.days ||
    typeof state.days !== 'object' ||
    Array.isArray(state.days)
  )
    throw invalid();
  validateSettings(state.settings);
  for (const [date, day] of Object.entries(state.days)) {
    if (
      !validDate(date) ||
      !day ||
      day.date !== date ||
      day.threshold !== 110 ||
      !nonnegativeInt(day.urineRevision) ||
      !urine(day.urine) ||
      !timestamp(day.createdAt) ||
      !timestamp(day.updatedAt) ||
      !Number.isSafeInteger(day.settingsVersion) ||
      day.settingsVersion < 1
    )
      throw invalid();
    validateItems(day.items);
    validateEvents(day.events);
  }
  return state;
}
export function parseBackup(text: string): LocalState {
  let data: { format?: string; data?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    throw new DomainError(
      'JSONファイルを読み取れません。お薬チェックのバックアップを選んでください。',
    );
  }
  if (!data || data.format !== 'okusuri-check-backup')
    throw new DomainError('お薬チェックのバックアップ形式ではありません。');
  return validateState(data.data);
}
export class LocalRepository {
  constructor(
    private storage: StoragePort,
    private clock = Date.now,
    private exclusive: Exclusive = async (task) => task(),
  ) {}
  raw(): string | null {
    return this.storage.getItem(STORAGE_KEY);
  }
  read(): LocalState | null {
    const raw = this.raw();
    if (raw === null) return null;
    try {
      return validateState(JSON.parse(raw));
    } catch {
      throw invalid();
    }
  }
  private write(state: LocalState): LocalState {
    // setItemは同期・原子的。失敗した場合はUIへ成功を返さない。
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      throw new DomainError(
        'このブラウザに保存できませんでした。記録は変更していません。空き容量とブラウザの保存設定を確認してください。',
      );
    }
    return state;
  }
  refresh(): Promise<LocalState> {
    return this.exclusive(() => {
      const now = this.clock(),
        date = tokyoDate(now);
      const state = this.read() ?? {
        schemaVersion: 1 as const,
        revision: 0,
        settings: structuredClone(defaultSettings),
        days: {},
      };
      if (state.days[date]) return state;
      return this.write({
        ...state,
        revision: state.revision + 1,
        days: { ...state.days, [date]: makeDay(date, state.settings, now) },
      });
    });
  }
  record(date: string, action: Action): Promise<LocalState> {
    return this.exclusive(() => {
      const now = this.clock();
      if (date !== tokyoDate(now))
        throw new DomainError('日付が変わりました。今日の画面で状態を確認してください。');
      const state = this.read(),
        day = state?.days[date];
      if (!state || !day) throw new DomainError('今日の記録を読み込み直してください。');
      const next = applyAction(day, action, now);
      if (next === day) return state;
      return this.write({
        ...state,
        revision: state.revision + 1,
        days: { ...state.days, [date]: next },
      });
    });
  }
  saveSettings(value: Settings, date: string): Promise<LocalState> {
    return this.exclusive(() => {
      const now = this.clock();
      if (date !== tokyoDate(now))
        throw new DomainError('日付が変わりました。設定を確認し直してください。');
      const settings = validateSettings(value),
        state = this.read();
      if (!state || !state.days[date])
        throw new DomainError('今日の記録を読み込み直してください。');
      if (settings.version !== state.settings.version)
        throw new DomainError(
          '設定が別のタブで変更されました。最新の設定を読み込み直してください。',
        );
      if (JSON.stringify(settings.medicines) === JSON.stringify(state.settings.medicines))
        return state;
      settings.version++;
      return this.write({
        ...state,
        revision: state.revision + 1,
        settings,
        days: { ...state.days, [date]: applySettings(state.days[date], settings, now) },
      });
    });
  }
  exportBackup(): string {
    const data = this.read();
    if (!data) throw new DomainError('保存された記録がありません。');
    return JSON.stringify(
      { format: 'okusuri-check-backup', exportedAt: this.clock(), data },
      null,
      2,
    );
  }
  restore(text: string, expectedRaw: string | null): Promise<LocalState> {
    const imported = parseBackup(text);
    return this.exclusive(() => {
      if (this.raw() !== expectedRaw)
        throw new DomainError(
          '確認中に記録が変更されました。最新の記録を確認してから読み込み直してください。',
        );
      let previousRevision = 0;
      try {
        previousRevision = this.read()?.revision ?? 0;
      } catch {
        /* 確認したバックアップで破損データを復旧できる */
      }
      const next = structuredClone(imported),
        now = this.clock(),
        date = tokyoDate(now);
      next.revision = Math.max(previousRevision, next.revision) + 1;
      if (!next.days[date]) next.days[date] = makeDay(date, next.settings, now);
      return this.write(next);
    });
  }
}
export function browserRepository(): LocalRepository {
  // localStorageの取得自体が拒否される環境でも、画面側でエラーを表示できるよう遅延参照。
  const storage: StoragePort = {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  };
  const exclusive: Exclusive = (task) =>
    navigator.locks ? navigator.locks.request(STORAGE_KEY, task) : Promise.resolve().then(task);
  return new LocalRepository(storage, Date.now, exclusive);
}
export function errorMessage(error: unknown): string {
  return error instanceof DomainError
    ? error.message
    : 'このブラウザの保存データにアクセスできません。ブラウザの保存設定を確認してください。';
}
