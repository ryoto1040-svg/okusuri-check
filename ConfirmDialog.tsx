import { useEffect, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '../localStore';
export function ConfirmDialog({
  title,
  children,
  disabled = false,
  onClose,
  onConfirm,
  confirmLabel,
}: {
  title: string;
  children: ReactNode;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  confirmLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title">{title}</h2>
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button disabled={busy} onClick={onClose}>
          キャンセル
        </button>
        <button className="primary" disabled={busy || disabled} onClick={() => void confirm()}>
          {busy ? '保存中…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
