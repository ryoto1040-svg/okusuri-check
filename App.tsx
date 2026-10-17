import { useLayoutEffect, useState } from 'react';
import {
  CheckCheck,
  History,
  House,
  Leaf,
  LoaderCircle,
  Moon,
  Pill,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import { status, type Action, type Item, type Period } from '../shared/domain';
import { useToday } from './useToday';
import { usePwa } from './usePwa';
import { dateLabel, time } from './format';
import { ConfirmDialog } from './components/ConfirmDialog';
import { HistoryView } from './components/HistoryView';
import { MedicineRow, Urine } from './components/Medicines';
import { SettingsView } from './components/SettingsView';
import { BackupPanel } from './components/BackupPanel';
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Pill size={22} />
      </span>
      <span>
        お薬チェック<small>ひとつずつ、毎日の安心</small>
      </span>
    </div>
  );
}
const navigation = [
  { key: 'today', Icon: House, label: '今日のお薬', mobile: '今日' },
  { key: 'history', Icon: History, label: '履歴', mobile: '履歴' },
  { key: 'settings', Icon: Settings2, label: '設定', mobile: '設定' },
] as const;
export default function App() {
  const [tab, setTab] = useState<'today' | 'history' | 'settings'>('today');
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);
  const { day, date, state, error, refresh, record, saveSettings, repository, restore } =
    useToday();
  const pwa = usePwa();
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<{
    item: Item;
    type: 'complete' | 'correct';
    date: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  async function saveAction(action: Action, actionDate: string) {
    await record(actionDate, action);
    setMessage('このブラウザに記録を保存しました。');
  }
  const completed = day?.items.filter((i) => status(i, day) === 'done').length ?? 0;
  const needed = day?.items.filter((i) => status(i, day) !== 'excluded').length ?? 0;
  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">DAILY MEDICATION</p>
        <nav>
          {navigation.map(({ key, Icon, label }) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <Icon size={20} />
              {label}
              {tab === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Leaf size={24} />
          <p>
            ひとつずつ、確かめて。
            <br />
            毎日の記録をこの端末に。
          </p>
          <span>お薬チェック · 端末内に保存</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="desktop-header">わが家のお薬ノート</span>
          <div className="storage-chip">
            <Smartphone size={14} />
            <span>この端末だけに保存</span>
          </div>
        </header>
        <main>
          <div className="device-note">
            <Smartphone size={18} />
            <p>
              <strong>記録はこの端末・このブラウザだけに保存されます。</strong>
              <span>ほかの端末とは共有されません。</span>
            </p>
          </div>
          <div className="offline-readiness" role="status">
            {pwa === 'ready'
              ? 'オフライン利用の準備ができています'
              : pwa === 'insecure'
                ? 'チェックはこのまま使えます。ホーム画面へのインストール・オフライン利用にはHTTPSの公開URLが必要です。'
                : pwa === 'failed'
                  ? 'オフライン準備を確認できませんでした。オンラインで開き直してください。'
                  : pwa === 'development'
                    ? '開発表示です。オフライン利用はビルド後に確認できます。'
                    : 'オフライン利用の準備中…'}
          </div>
          {message && (
            <div className="toast" role="status">
              <span>{message}</span>
              <button aria-label="メッセージを閉じる" onClick={() => setMessage('')}>
                <X size={17} />
              </button>
            </div>
          )}
          {error ? (
            <>
              <section className="panel">
                <h1>保存状態を確認してください</h1>
                <p className="error" role="alert">
                  {error}
                </p>
                <button onClick={() => void refresh()}>読み込みを再試行</button>
              </section>
              <BackupPanel repository={repository} restore={restore} recovery />
            </>
          ) : !day || !state ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              保存データを読み込み中…
            </div>
          ) : (
            <>
              {tab === 'today' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">TODAY'S CARE</span>
                      <h1>今日のお薬</h1>
                      <p>
                        {dateLabel(date)}
                        <span className="today-badge">今日</span>
                      </p>
                    </div>
                    <div className="date-tile">
                      <span>{date.slice(5, 7)}月</span>
                      <strong>{Number(date.slice(8))}</strong>
                    </div>
                  </div>
                  <section className="progress-card">
                    <div className="progress-icon">
                      <CheckCheck size={27} />
                    </div>
                    <div className="progress-copy">
                      <h2>
                        {completed === needed
                          ? '今日の確認がそろいました'
                          : '今日も、ひとつずつ確認しましょう'}
                      </h2>
                      <p>
                        実施済み {completed}件 · 対象外 {day.items.length - needed}件
                      </p>
                      <div className="progress-track">
                        <div style={{ width: `${needed ? (completed / needed) * 100 : 100}%` }} />
                      </div>
                    </div>
                    <div className="progress-number">
                      {completed}
                      <span> / {needed}</span>
                      <small>実施済み</small>
                    </div>
                  </section>
                  <div className="period-grid">
                    {(['morning', 'evening'] as Period[]).map((period) => (
                      <section className={`period-card ${period}`} key={period}>
                        <div className="period-heading">
                          <span className="period-icon">
                            {period === 'morning' ? <Sun size={23} /> : <Moon size={22} />}
                          </span>
                          <div>
                            <h2>{period === 'morning' ? '朝' : '夕'}のお薬</h2>
                            <p>実施したら、ひとつずつ記録</p>
                          </div>
                          <span className="count-pill">
                            {
                              day.items.filter(
                                (i) =>
                                  i.period === period &&
                                  ['done', 'excluded'].includes(status(i, day)),
                              ).length
                            }{' '}
                            / {day.items.filter((i) => i.period === period).length} 確認
                          </span>
                        </div>
                        {period === 'morning' && (
                          <Urine
                            day={day}
                            disabled={false}
                            onSave={(value, revision, actionDate) =>
                              saveAction({ type: 'urine', value, revision }, actionDate)
                            }
                          />
                        )}
                        <div className="medicine-list">
                          {day.items
                            .filter((i) => i.period === period)
                            .map((item) => (
                              <MedicineRow
                                key={item.id}
                                item={item}
                                day={day}
                                disabled={false}
                                onClick={(type) => {
                                  setReason('');
                                  setDialog({ item: structuredClone(item), type, date });
                                }}
                              />
                            ))}
                        </div>
                      </section>
                    ))}
                  </div>
                  <div className="care-note">
                    <ShieldCheck size={18} />
                    <p>
                      実際に投与したことを確認してから「実施を記録」を押してください。
                      <br />
                      医師の指示に基づく実施状況を記録・確認する補助ツールです。
                    </p>
                  </div>
                </>
              )}
              {tab === 'history' && <HistoryView today={date} days={state.days} />}
              {tab === 'settings' && (
                <SettingsView
                  settings={state.settings}
                  date={date}
                  save={saveSettings}
                  repository={repository}
                  restore={restore}
                  onMessage={setMessage}
                />
              )}
            </>
          )}
        </main>
        <footer>
          ひとつずつ確かめて、毎日の安心に。<span>時刻はすべて日本時間</span>
        </footer>
      </div>
      <nav className="bottom-nav">
        {navigation.map(({ key, Icon, mobile }) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <Icon size={21} />
            {mobile}
          </button>
        ))}
      </nav>
      {dialog && (
        <ConfirmDialog
          title={dialog.type === 'complete' ? '実施を記録しますか？' : '実施記録を訂正しますか？'}
          disabled={
            !!error || !day || dialog.date !== date || (dialog.type === 'correct' && !reason.trim())
          }
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await saveAction(
              { type: dialog.type, itemId: dialog.item.id, revision: dialog.item.revision, reason },
              dialog.date,
            );
            setDialog(null);
          }}
          confirmLabel={
            dialog.type === 'complete' ? '投与したことを確認して記録' : '訂正して未実施に戻す'
          }
        >
          <p className="dialog-med">
            {dialog.item.period === 'morning' ? '朝' : '夕'} · {dialog.item.name}
          </p>
          {dialog.type === 'complete' ? (
            <p>実際に投与したことを確認してください。端末の現在時刻を実施時刻として保存します。</p>
          ) : (
            <>
              <p>元の実施時刻（{time(dialog.item.completedAt)}）と訂正日時は履歴に残ります。</p>
              <label>
                訂正理由
                <textarea
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例：誤って実施済みにしたため"
                />
              </label>
            </>
          )}
          {dialog.date !== date && (
            <p className="error">日付が変わりました。閉じて今日の記録を確認してください。</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
