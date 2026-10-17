import { useEffect, useState } from 'react';
import { Droplets, Pill, Settings2, Smartphone } from 'lucide-react';
import { type Settings } from '../../shared/domain';
import { type LocalRepository } from '../localStore';
import { BackupPanel } from './BackupPanel';
import { ConfirmDialog } from './ConfirmDialog';
export function SettingsView({
  settings,
  date,
  save,
  repository,
  restore,
  onMessage,
}: {
  settings: Settings;
  date: string;
  save: (s: Settings, date: string) => Promise<void>;
  repository: LocalRepository;
  restore: (text: string, raw: string | null) => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(settings));
  const [dirty, setDirty] = useState(false),
    [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) setDraft(structuredClone(settings));
  }, [settings, dirty]);
  const stale = draft.version !== settings.version;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1>設定</h1>
          <p>この端末のお薬と保存について。</p>
        </div>
        <Settings2 className="heading-icon" />
      </div>
      <section className="panel">
        <h2>
          <Smartphone size={20} />
          この端末だけの記録
        </h2>
        <p>
          記録はこの端末・このブラウザの中に保存されます。ほかのスマートフォンやブラウザとは共有されません。
        </p>
        <p className="muted">
          ログインは不要です。チェック・履歴の保存に外部通信は使いません。実施時刻と日付は端末の時計を使うため、日時の自動設定を有効にしてください。シークレットモードやブラウザのデータ削除では記録が失われることがあります。
        </p>
      </section>
      <section className="panel">
        <h2>
          <Pill size={20} />
          一時的なお薬
        </h2>
        <p className="muted">
          使い切った薬は「有効」を外して保存してください。本日以降の対象から外し、すでに実施した時刻と過去の履歴は保持します。
        </p>
        {draft.medicines
          .filter((m) => m.temporary)
          .map((med) => (
            <div className="temporary-editor" key={med.id}>
              <div>
                <strong>{med.name}</strong>
                <small>夕のお薬</small>
              </div>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={med.enabled}
                  onChange={(e) => {
                    setDirty(true);
                    setDraft({
                      ...draft,
                      medicines: draft.medicines.map((m) =>
                        m.id === med.id ? { ...m, enabled: e.target.checked } : m,
                      ),
                    });
                  }}
                />
                有効
              </label>
            </div>
          ))}
        {stale && (
          <p className="notice">
            別のタブまたはバックアップの復元で設定が変わりました。
            <button
              className="text-button"
              onClick={() => {
                setDraft(structuredClone(settings));
                setDirty(false);
              }}
            >
              最新の設定を読み込む
            </button>
          </p>
        )}
        <div className="settings-save">
          <span>{dirty ? '未保存の変更があります' : '設定は保存されています'}</span>
          <button
            className="primary"
            disabled={!dirty || stale}
            onClick={() => setConfirmedDate(date)}
          >
            変更を保存
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>
          <Droplets size={20} />
          朝の点鼻の条件
        </h2>
        <p>
          夜間尿量 <strong>110g以上</strong>で対象、110g未満で対象外、未入力は確認待ちです。
        </p>
        <p className="muted">
          保護者から伝えられた指示条件を表示しています。アプリが医学的に判断するものではありません。
        </p>
      </section>
      <BackupPanel repository={repository} restore={restore} />
      <section className="panel">
        <h2>ホーム画面に追加</h2>
        <p>
          AndroidのChromeで公開URLを開き、メニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。
        </p>
        <p className="muted">
          一度オンラインで開いてオフライン準備が完了すると、通信がなくても記録できます。データは同じ公開URL・同じブラウザで使い続けてください。
        </p>
      </section>
      {confirmedDate && (
        <ConfirmDialog
          title="一時薬の設定を保存しますか？"
          disabled={confirmedDate !== date || stale}
          confirmLabel="設定を保存"
          onClose={() => setConfirmedDate(null)}
          onConfirm={async () => {
            await save(draft, confirmedDate);
            setDirty(false);
            setConfirmedDate(null);
            onMessage('設定を保存しました。過去の実施履歴は保持しています。');
          }}
        >
          <p>
            医師の現在の指示と一致していることを確認してください。有効・無効の変更は本日から反映します。実施済みの記録は保持します。
          </p>
          {confirmedDate !== date && (
            <p className="error">日付が変わりました。閉じて設定を確認し直してください。</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
