import { ArrowRight, CheckCircle2, Clock3, Send } from 'lucide-react';
import { mainWork } from '../data';

export function Dashboard({ onOpenWork, onOpenProfile }: { onOpenWork: () => void; onOpenProfile: () => void }) {
  return (
    <div className="page page--dashboard">
      <header className="page-heading">
        <div>
          <h1>Добрый вечер, Алекс</h1>
          <p>Рады видеть вас в Доме Некроманта. Продолжайте делать истории лучше.</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card continue-card">
          <div className="section-title-row"><h2>Продолжить чтение</h2><span className="bookmark-mark">⌑</span></div>
          <div className="continue-card__body">
            <div className="cover cover--large" aria-label="Обложка произведения"><span>Призванный<br />в другой мир</span></div>
            <div className="continue-card__content">
              <h3>{mainWork.title}</h3>
              <p>Глава 127. Непрошеный гость</p>
              <div className="metric-label"><span>Прогресс чтения</span><strong>{mainWork.readingProgress}%</strong></div>
              <div className="progress"><span style={{ width: `${mainWork.readingProgress}%` }} /></div>
              <div className="metric-label metric-label--proof"><span>Прогресс вычитки</span><strong>{mainWork.proofreadingProgress}%</strong></div>
              <div className="proof-dots"><b /><b /><b /><b /><i /><i /><i /></div>
              <button className="button button--dark button--full" onClick={onOpenWork}>Продолжить</button>
            </div>
          </div>
        </section>

        <section className="card updates-card">
          <div className="section-title-row"><h2>Недавно обновлено</h2><button className="text-button">Смотреть все <ArrowRight size={17} /></button></div>
          {[
            ['Дом пепла', 'Глава 58. Тихий коридор', 'На вычитке', '2 ч. назад'],
            ['Пепельный архив', 'Глава 14. Под печатью', 'Черновик', '5 ч. назад'],
            ['Северный обет', 'Глава 203. След на снегу', 'На вычитке', '1 д. назад'],
          ].map((item) => (
            <div className="update-row" key={item[0]}>
              <div className="cover cover--thumb" />
              <div className="update-row__copy"><strong>{item[0]}</strong><span>{item[1]}</span><small>{item[3]}</small></div>
              <span className="pill">{item[2]}</span>
              <button className="kebab">⋮</button>
            </div>
          ))}
        </section>

        <section className="card contribution-card">
          <h2>Моя редактура</h2>
          <div className="stats-row">
            <div className="stat"><Send size={24} /><span>Отправлено</span><strong>24</strong></div>
            <div className="stat"><CheckCircle2 size={24} /><span>Принято</span><strong>17</strong></div>
            <div className="stat"><Clock3 size={24} /><span>На рассмотрении</span><strong>5</strong></div>
          </div>
          <p className="muted">Спасибо за ваш вклад в качество наших историй.</p>
          <button className="text-button" onClick={onOpenProfile}>Перейти к моим правкам <ArrowRight size={17} /></button>
        </section>

        <section className="card activity-card">
          <div className="section-title-row"><h2>Активность сообщества</h2><button className="text-button">Смотреть все <ArrowRight size={17} /></button></div>
          {[
            ['@mira', 'предложила правку в «Северный обет»', '15 минут назад'],
            ['@alex', 'отметил неточность перевода', '1 час назад'],
            ['@vera', 'приняла исправление', '2 часа назад'],
          ].map((row) => (
            <div className="activity-row" key={row[0] + row[2]}><div className="mini-avatar">{row[0][1]?.toUpperCase()}</div><div><strong>{row[0]}</strong> {row[1]}<small>{row[2]}</small></div><ArrowRight size={18} /></div>
          ))}
        </section>
      </div>
    </div>
  );
}
