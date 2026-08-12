import { BookOpen, CheckCircle2, Circle, MessageCircle, UserRound } from 'lucide-react';
import { chapters, mainWork } from '../data';

const readingLabel = { read: 'Прочитано', reading: 'Читаю', unread: 'Не прочитано' } as const;
const proofLabel = { verified: 'Проверено', editing: 'На вычитке', suggestions: 'С правками', unread: 'Не прочитано' } as const;

export function WorkDetail({ onRead }: { onRead: () => void }) {
  return (
    <div className="page">
      <section className="work-hero card">
        <div className="cover cover--hero"><span>Призванный<br />в другой мир</span></div>
        <div className="work-hero__info">
          <h1>{mainWork.title}</h1>
          <p>{mainWork.description}</p>
          <dl>
            <div><UserRound size={18} /><dt>Автор</dt><dd>{mainWork.author}</dd></div>
            <div><BookOpen size={18} /><dt>Перевод</dt><dd>{mainWork.translator}</dd></div>
          </dl>
          <div className="genre-line"><span>Жанры</span> Фэнтези, Приключения, Попаданцы</div>
        </div>
        <div className="work-hero__progress">
          <div className="metric-label"><span>Прогресс вычитки</span><strong>{mainWork.proofreadingProgress}%</strong></div>
          <div className="progress"><span style={{ width: `${mainWork.proofreadingProgress}%` }} /></div>
          <div className="proof-dots"><b /><b /><b /><i /><i /></div>
          <hr />
          <div className="metric-label"><span>Ваш прогресс чтения</span><strong>{mainWork.readingProgress}%</strong></div>
          <div className="progress"><span style={{ width: `${mainWork.readingProgress}%` }} /></div>
          <p className="muted">127 / 187 глав</p>
          <div className="summary-pills"><span>Проверено <b>84</b></span><span>На вычитке <b>18</b></span><span>С правками <b>12</b></span><span>Не прочитано <b>73</b></span></div>
        </div>
      </section>

      <section className="card chapters-card">
        <h2>Главы</h2>
        <div className="tabs"><button className="is-active">Все</button><button>Непрочитанные</button><button>С правками</button><button>Проверенные</button></div>
        <div className="chapters-table">
          <div className="chapters-head"><span>Глава</span><span>Статус чтения</span><span>Статус вычитки</span><span>Предложения сообщества</span><span>Обновлено</span><span /></div>
          {chapters.map((chapter) => (
            <div className={`chapter-row ${chapter.number === 127 ? 'is-current' : ''}`} key={chapter.id}>
              <strong>Глава {chapter.number}. {chapter.title}</strong>
              <span className={`chapter-state chapter-state--${chapter.readingStatus}`}>{chapter.readingStatus === 'unread' ? <Circle size={15} /> : <CheckCircle2 size={15} />}{readingLabel[chapter.readingStatus]}</span>
              <span className={`chapter-state chapter-state--${chapter.proofreadingStatus}`}>{chapter.proofreadingStatus === 'unread' ? <Circle size={15} /> : <CheckCircle2 size={15} />}{proofLabel[chapter.proofreadingStatus]}</span>
              <span><MessageCircle size={15} /> {chapter.suggestions}</span>
              <span>{chapter.updated}</span>
              {chapter.number === 127 ? <button className="button button--dark button--small" onClick={onRead}>Читать</button> : <span className="arrow">›</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
