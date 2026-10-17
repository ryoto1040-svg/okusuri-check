import { useState } from 'react';
import { Droplets, History } from 'lucide-react';
import { labels, status, type AuditEvent, type Day, type Period } from '../../shared/domain';
import { dateLabel, time } from '../format';
export function HistoryView({ today, days }: { today: string; days: Record<string, Day> }) {
  const [selected, setSelected] = useState(today);
  const day = days[selected];
  const dates = Object.keys(days).sort().reverse();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CARE HISTORY</span>
          <h1>お薬の履歴</h1>
          <p>毎日の記録を、あとから確認。</p>
        </div>
        <History className="heading-icon" />
      </div>
      <section className="panel">
        <label>
          確認する日付
          <input
            type="date"
            value={selected}
            max={today}
            onChange={(e) => {
              if (e.target.value) setSelected(e.target.value);
            }}
          />
        </label>
        <label>
          保存されている日
          <select
            value={dates.includes(selected) ? selected : ''}
            onChange={(e) => {
              if (e.target.value) setSelected(e.target.value);
            }}
          >
            <option value="" disabled>
              日付を選択
            </option>
            {dates.map((date) => (
              <option value={date} key={date}>
                {date}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          履歴は閲覧専用です。この端末・このブラウザに保存した記録を表示します。
        </p>
      </section>
      {day ? (
        <>
          <section className="panel">
            <h2>{dateLabel(selected)}</h2>
            <p className="history-urine">
              <Droplets size={18} />
              夜間尿量：<strong>{day.urine === null ? '未入力' : `${day.urine}g`}</strong>
              <span>当日の条件：{day.threshold}g以上</span>
            </p>
            {(['morning', 'evening'] as Period[]).map((period) => (
              <div key={period} className="history-period">
                <h3>{period === 'morning' ? '朝' : '夕'}のお薬</h3>
                {day.items
                  .filter((i) => i.period === period)
                  .map((item) => (
                    <div className="history-row" key={item.id}>
                      <span>{item.name}</span>
                      <span className={`state-label ${status(item, day)}`}>
                        {labels[status(item, day)]}
                      </span>
                      <time>{time(item.completedAt)}</time>
                    </div>
                  ))}
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>実施・訂正の履歴</h2>
            {day.events.length ? (
              [...day.events].reverse().map((event) => <EventRow key={event.id} event={event} />)
            ) : (
              <p className="muted">まだ操作の記録はありません。</p>
            )}
          </section>
        </>
      ) : (
        <div className="empty">この日の記録はありません。</div>
      )}
    </>
  );
}
function EventRow({ event }: { event: AuditEvent }) {
  return (
    <div className="event-row">
      <time>{time(event.at)}</time>
      <div>
        {event.type === 'urine' ? (
          <>
            <strong>夜間尿量を保存</strong>
            <p>
              {event.before === null ? '未入力' : `${event.before}g`} →{' '}
              {event.after === null ? '未入力' : `${event.after}g`}
            </p>
          </>
        ) : event.type === 'temporary-settings' ? (
          <>
            <strong>一時的なお薬の設定を変更</strong>
            {event.after
              .filter((i) => event.before.find((b) => b.id === i.id)?.enabled !== i.enabled)
              .map((i) => (
                <p key={i.id}>
                  {i.name}：{i.enabled ? '有効' : '終了'}
                </p>
              ))}
          </>
        ) : (
          <>
            <strong>
              {event.period === 'morning' ? '朝' : '夕'} · {event.name} —{' '}
              {event.type === 'correct' ? '訂正' : '実施を記録'}
            </strong>
            {event.type === 'correct' && (
              <p>
                元の実施時刻：{time(event.before.completedAt)}
                <br />
                訂正理由：{event.reason}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
