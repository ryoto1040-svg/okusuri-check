import { useState, type ChangeEvent } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { DomainError, tokyoDate } from '../../shared/domain';
import { errorMessage, parseBackup, type LocalRepository } from '../localStore';
import { ConfirmDialog } from './ConfirmDialog';
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function BackupPanel({
  repository,
  restore,
  recovery = false,
}: {
  repository: LocalRepository;
  restore: (text: string, raw: string | null) => Promise<void>;
  recovery?: boolean;
}) {
  const [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [pending, setPending] = useState<{
    text: string;
    raw: string | null;
    name: string;
    count: number;
  } | null>(null);
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setMessage('');
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new DomainError('ファイルが大きすぎます。10MB以下のバックアップを選んでください。');
      const text = await file.text(),
        data = parseBackup(text);
      setPending({
        text,
        raw: repository.raw(),
        name: file.name,
        count: Object.keys(data.days).length,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <section className="panel backup-panel">
      <h2>
        <Download size={20} />
        記録のバックアップ
      </h2>
      <p className="muted">
        ブラウザのデータ削除や端末交換に備えて、記録をファイルに保存できます。バックアップには薬の記録が含まれます。大切に保管してください。
      </p>
      <div className="button-row">
        <button
          onClick={() => {
            try {
              let text: string | null;
              let diagnostic = false;
              if (recovery) {
                try {
                  text = repository.exportBackup();
                } catch {
                  text = repository.raw();
                  diagnostic = true;
                }
              } else text = repository.exportBackup();
              if (text === null) throw new DomainError('保存データがありません。');
              download(text, `okusuri-${diagnostic ? 'recovery-' : 'backup-'}${tokyoDate()}.json`);
              setMessage(
                diagnostic
                  ? '元データの診断用ファイルを保存しました。通常の復元用バックアップとは形式が異なります。'
                  : 'ファイルの保存を開始しました。ダウンロード先をご確認ください。',
              );
              setError('');
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          <Download size={17} />
          {recovery ? '元の保存データを書き出す' : 'バックアップを保存'}
        </button>
        <label className="file-button">
          <FolderOpen size={17} />
          バックアップを読み込む
          <input type="file" accept="application/json,.json" onChange={(e) => void choose(e)} />
        </label>
      </div>
      <p className="muted">
        読み込みは、このブラウザの現在の記録全体を置き換えます。確認画面で承認するまで変更しません。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
      {pending && (
        <ConfirmDialog
          title="バックアップを復元しますか？"
          confirmLabel="現在の記録を置き換えて復元"
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await restore(pending.text, pending.raw);
            setPending(null);
            setMessage('バックアップを復元しました。今日と履歴の内容を確認してください。');
          }}
        >
          <p>
            {pending.name}
            <br />
            {pending.count}日分の記録
          </p>
          <p>
            この端末・このブラウザの現在の記録全体を置き換えます。必要な記録は、先にバックアップを保存してください。
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
