import { CheckCircle2, Clock3, Send, XCircle } from 'lucide-react';

export function Profile() {
  return (
    <div className="page profile-page">
      <header className="profile-hero">
        <div className="profile-avatar">A</div>
        <div><h1>@alex</h1><strong>Редактор</strong><p>Редактирую и вычитываю переводы фэнтези с вниманием к деталям и стилю.</p></div>
      </header>
      <div className="profile-stats">
        <div className="card stat-card"><Send /><span>Предложений</span><strong>138</strong></div>
        <div className="card stat-card"><CheckCircle2 /><span>Принято</span><strong>119</strong></div>
        <div className="card stat-card"><Clock3 /><span>На рассмотрении</span><strong>8</strong></div>
        <div className="card stat-card"><XCircle /><span>Отклонено</span><strong>11</strong></div>
        <div className="acceptance"><span>Принято</span><strong>86%</strong><div className="progress"><span style={{ width: '86%' }} /></div></div>
      </div>
      <section className="card profile-table-card">
        <div className="section-title-row"><h2>Последние правки</h2><button className="text-button">Смотреть все ›</button></div>
        {[
          ['Призванный в другой мир', 'Глава 127. Непрошеный гость', 'одел → надел', 'Принято', 'сегодня'],
          ['Северный обет', 'Глава 203. След на снегу', '«вернись,» → «вернись.»', 'Принято', 'вчера'],
          ['Дом пепла', 'Глава 58. Тихий коридор', 'steel door → стальная дверь', 'На рассмотрении', '2 дня назад'],
        ].map((row) => <div className="profile-row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><span>{row[4]}</span><button className="kebab">⋮</button></div>)}
      </section>
    </div>
  );
}
