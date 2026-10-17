import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tokyoDate, type Action, type Settings } from '../shared/domain';
import { browserRepository, errorMessage, STORAGE_KEY, type LocalState } from './localStore';
export function useToday() {
  const repository = useMemo(browserRepository, []);
  const [state, setState] = useState<LocalState | null>(null);
  const [date, setDate] = useState(tokyoDate());
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (mounted.current) setDate(tokyoDate());
    try {
      const next = await repository.refresh();
      if (mounted.current) {
        setState(next);
        setError('');
        setDate(tokyoDate());
      }
    } catch (e) {
      if (mounted.current) {
        setError(errorMessage(e));
        setState(null);
      }
    }
  }, [repository]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    let previousDate = tokyoDate();
    const timer = window.setInterval(() => {
      const today = tokyoDate();
      if (today !== previousDate) {
        previousDate = today;
        void refresh();
      }
    }, 1000);
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) void refresh();
    };
    const shown = () => {
      void refresh();
    };
    window.addEventListener('storage', changed);
    window.addEventListener('pageshow', shown);
    document.addEventListener('visibilitychange', visible);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener('storage', changed);
      window.removeEventListener('pageshow', shown);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  async function commit(task: Promise<LocalState>) {
    const next = await task;
    if (mounted.current) {
      setState(next);
      setError('');
      setDate(tokyoDate());
    }
  }
  return {
    state,
    date,
    day: state?.days[date] ?? null,
    error,
    refresh,
    repository,
    record: (date: string, action: Action) => commit(repository.record(date, action)),
    saveSettings: (settings: Settings, date: string) =>
      commit(repository.saveSettings(settings, date)),
    restore: (text: string, raw: string | null) => commit(repository.restore(text, raw)),
  };
}
