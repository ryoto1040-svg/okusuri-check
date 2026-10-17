import { useEffect, useState } from 'react';
import { Check, Clock3, Droplets, Pill } from 'lucide-react';
import { labels, status, type Day, type Item } from '../../shared/domain';
import { time } from '../format';
import { ConfirmDialog } from './ConfirmDialog';
export function MedicineRow({
  item,
  day,
  disabled,
  onClick,
}: {
  item: Item;
  day: Day;
  disabled: boolean;
  onClick: (type: 'complete' | 'correct') => void;
}) {
  const s = status(item, day);
  return (
    <div className={`medicine-row ${s}`}>
      <span className="state-icon">
        {s === 'done' ? (
          <Check size={20} />
        ) : s === 'waiting' ? (
          <Clock3 size={19} />
        ) : s === 'excluded' ? (
          <span>−</span>
        ) : (
          <Pill size={19} />
        )}
      </span>
      <div className="medicine-text">
        <h3>
          {item.name}
          {item.temporary && <span className="temporary">一時</span>}
        </h3>
        <span className={`state-label ${s}`}>
          {labels[s]}
          {s === 'done' && ` · ${time(item.completedAt)}`}
        </span>
        {s === 'waiting' && <small>夜間尿量を入力してください</small>}
        {s === 'excluded' && (
          <small>
            {!item.enabled ? '設定で終了しています' : `登録条件の${day.threshold}g未満`}
          </small>
        )}
      </div>
      <div className="medicine-action">
        {s === 'pending' ? (
          <button disabled={disabled} onClick={() => onClick('complete')} className="check-button">
            実施を記録
          </button>
        ) : s === 'done' ? (
          <button disabled={disabled} onClick={() => onClick('correct')} className="correct-button">
            訂正
          </button>
        ) : null}
      </div>
    </div>
  );
}
export function Urine({
  day,
  disabled,
  onSave,
}: {
  day: Day;
  disabled: boolean;
  onSave: (value: number | null, revision: number, date: string) => Promise<void>;
}) {
  const [value, setValue] = useState(day.urine === null ? '' : String(day.urine));
  const [edit, setEdit] = useState<{
    original: number;
    value: number | null;
    revision: number;
    date: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setValue(day.urine === null ? '' : String(day.urine));
    setError('');
  }, [day.date, day.urine]);
  const invalid =
    value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10000);
  const changed = value !== (day.urine === null ? '' : String(day.urine));
  const verdict =
    day.urine === null
      ? '未入力 · 確認待ち'
      : day.urine >= day.threshold
        ? '点鼻が必要な条件'
        : '点鼻は対象外';
  async function initialSave() {
    setBusy(true);
    setError('');
    try {
      await onSave(value === '' ? null : Number(value), day.urineRevision, day.date);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="urine-card">
      <div className="urine-title">
        <Droplets size={17} />
        <label htmlFor="urine">夜間尿量</label>
        <span>朝の記録</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled || busy || invalid || !changed) return;
          if (day.urine !== null)
            setEdit({
              original: day.urine,
              value: value === '' ? null : Number(value),
              revision: day.urineRevision,
              date: day.date,
            });
          else void initialSave();
        }}
      >
        <div className="unit-input">
          <input
            id="urine"
            type="number"
            inputMode="decimal"
            min="0"
            max="10000"
            step="any"
            placeholder="未入力"
            value={value}
            disabled={disabled || busy}
            onChange={(e) => setValue(e.target.value)}
          />
          <span>g</span>
        </div>
        <button disabled={disabled || busy || invalid || !changed} className="urine-save">
          {busy ? '保存中' : '保存'}
        </button>
      </form>
      <p className={`urine-verdict ${day.urine === null ? 'waiting-text' : ''}`}>
        {day.urine === null ? <Clock3 size={14} /> : <Check size={14} />}
        {verdict}
      </p>
      <p className="condition-note">
        登録された指示条件：{day.threshold}g以上で朝の点鼻が対象。未入力のときは確認待ちです。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {edit && (
        <ConfirmDialog
          title="夜間尿量を変更しますか？"
          disabled={disabled || edit.date !== day.date}
          confirmLabel="変更を保存"
          onClose={() => setEdit(null)}
          onConfirm={async () => {
            await onSave(edit.value, edit.revision, edit.date);
            setEdit(null);
          }}
        >
          <p>
            {edit.original}g → {edit.value === null ? '未入力' : `${edit.value}g`}
          </p>
          <p>変更前の値と日時を履歴に残します。実施済みの記録は保持します。</p>
          {edit.date !== day.date && (
            <p className="error">日付が変わりました。閉じて今日の記録を確認してください。</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
