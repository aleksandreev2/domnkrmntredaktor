import { BookOpen, CheckCircle2, Circle, MessageCircle, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { editorApi, type ApiChapter, type ApiWork } from '../api';

const readingLabel = { read: 'Прочитано', reading: 'Читаю', unread: 'Не прочитано' } as const;
const proofLabel = { verified: 'Проверено', editing: 'На вычитке', suggestions: 'С правками', unread: 'Черновик' } as const;

type FilterKey = 'all' | 'unread' | 'suggestions' | 'verified';

function readingState(chapter: ApiChapter): keyof typeof readingLabel {
  if (chapter.progress_percent >= 100) return 'read';
  if (chapter.progress_percent > 0) return 'reading';
  return 'unread';
}

function proofState(chapter: ApiChapter): keyof typeof proofLabel {
  if (chapter.suggestion_count > 0) return 'suggestions';
  if (chapter.status === 'verified') return 'verified';
  if (chapter.status === 'editing') return 'editing';
  return 'unread';
}

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

interface WorkDetailProps {
  workId: string | null;
  onResolveWork: (workId: string) => void;
  onRead: (chapterId: string) => void;
}

export function WorkDetail({ workId, onResolveWork, onRead }: WorkDetailProps) {
  const [works, setWorks] = useState<ApiWork[]>([]);
  const [chapters, setChapters] = useState<ApiChapter[]>([]);
  const [activeWorkId, setActiveWorkId] = useState<string | null>(workId);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadWorks = async () => {
      try {
        const nextWorks = await editorApi.works();
        if (cancelled) return;
        setWorks(nextWorks);
        const resolved = workId && nextWorks.some((work) => work.id === workId) ? workId : nextWorks[0]?.id ?? null;
        setActiveWorkId(resolved);
        if (resolved) onResolveWork(resolved);
        if (!resolved) setLoading(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить произведения.');
          setLoading(false);
        }
      }
    };
    void loadWorks();
    return () => { cancelled = true; };
  }, [workId, onResolveWork]);

  useEffect(() => {
    if (!activeWorkId) return;
    let cancelled = false;
    setLoading(true);
    const loadChapters = async () => {
      try {
        const nextChapters = await editorApi.chapters(activeWorkId);
        if (!cancelled) {
          setChapters(nextChapters);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить главы.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadChapters();
    return () => { cancelled = true; };
  }, [activeWorkId]);

  const work = works.find((item) => item.id === activeWorkId) ?? null;
  const verified = chapters.filter((chapter) => chapter.status === 'verified').length;
  const editing = chapters.filter((chapter) => chapter.status === 'editing').length;
  const withSuggestions = chapters.filter((chapter) => chapter.suggestion_count > 0).length;
  const unread = chapters.filter((chapter) => chapter.progress_percent === 0).length;
  const proofreadingProgress = chapters.length ? Math.round((verified / chapters.length) * 100) : 0;
  const readingProgress = chapters.length ? Math.round(chapters.reduce((sum, chapter) => sum + chapter.progress_percent, 0) / chapters.length) : 0;

  const filteredChapters = useMemo(() => chapters.filter((chapter) => {
    if (filter === 'unread') return chapter.progress_percent === 0;
    if (filter === 'suggestions') return chapter.suggestion_count > 0;
    if (filter === 'verified') return chapter.status === 'verified';
    return true;
  }), [chapters, filter]);

  if (loading && !work) {
    return <div className="page"><section className="card empty-state"><p>Загружаем произведение…</p></section></div>;
  }

  if (!work) {
    return <div className="page"><section className="card empty-state"><h1>Произведений пока нет</h1><p>{error ?? 'Запустите синхронизацию Google Drive, чтобы здесь появились главы.'}</p></section></div>;
  }

  return (
    <div className="page">
      {error && <section className="card empty-state"><p>{error}</p></section>}

      <section className="work-hero card">
        <div
          className="cover cover--hero"
          style={work.cover_url ? { backgroundImage: `url(${work.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          {!work.cover_url && <span>{work.title}</span>}
        </div>
        <div className="work-hero__info">
          <h1>{work.title}</h1>
          <p>{work.description || 'Описание пока не добавлено.'}</p>
          <dl>
            <div><UserRound size={18} /><dt>Автор</dt><dd>{work.author || '—'}</dd></div>
            <div><BookOpen size={18} /><dt>Перевод</dt><dd>{work.translator || 'Дом Некроманта'}</dd></div>
          </dl>
          <div className="genre-line"><span>Главы</span> {chapters.length} синхронизировано из Google Drive</div>
        </div>
        <div className="work-hero__progress">
          <div className="metric-label"><span>Прогресс вычитки</span><strong>{proofreadingProgress}%</strong></div>
          <div className="progress"><span style={{ width: `${proofreadingProgress}%` }} /></div>
          <div className="proof-dots"><b /><b /><b /><i /><i /></div>
          <hr />
          <div className="metric-label"><span>Ваш прогресс чтения</span><strong>{readingProgress}%</strong></div>
          <div className="progress"><span style={{ width: `${readingProgress}%` }} /></div>
          <p className="muted">{chapters.filter((chapter) => chapter.progress_percent >= 100).length} / {chapters.length} глав прочитано</p>
          <div className="summary-pills">
            <span>Проверено <b>{verified}</b></span>
            <span>На вычитке <b>{editing}</b></span>
            <span>С правками <b>{withSuggestions}</b></span>
            <span>Не прочитано <b>{unread}</b></span>
          </div>
        </div>
      </section>

      <section className="card chapters-card">
        <h2>Главы</h2>
        <div className="tabs">
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Все</button>
          <button className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>Непрочитанные</button>
          <button className={filter === 'suggestions' ? 'is-active' : ''} onClick={() => setFilter('suggestions')}>С правками</button>
          <button className={filter === 'verified' ? 'is-active' : ''} onClick={() => setFilter('verified')}>Проверенные</button>
        </div>
        <div className="chapters-table">
          <div className="chapters-head"><span>Глава</span><span>Статус чтения</span><span>Статус вычитки</span><span>Предложения сообщества</span><span>Обновлено</span><span /></div>
          {filteredChapters.map((chapter) => {
            const readState = readingState(chapter);
            const editState = proofState(chapter);
            return (
              <div className={`chapter-row ${readState === 'reading' ? 'is-current' : ''}`} key={chapter.id}>
                <strong>Глава {chapter.chapter_number}. {chapter.title}</strong>
                <span className={`chapter-state chapter-state--${readState}`}>{readState === 'unread' ? <Circle size={15} /> : <CheckCircle2 size={15} />}{readingLabel[readState]}</span>
                <span className={`chapter-state chapter-state--${editState}`}>{editState === 'unread' ? <Circle size={15} /> : <CheckCircle2 size={15} />}{proofLabel[editState]}</span>
                <span><MessageCircle size={15} /> {chapter.suggestion_count}</span>
                <span>{formatUpdated(chapter.updated_at)}</span>
                <button className="button button--dark button--small" onClick={() => onRead(chapter.id)}>Читать</button>
              </div>
            );
          })}
          {!loading && filteredChapters.length === 0 && <div className="empty-state"><p>Глав с таким фильтром нет.</p></div>}
        </div>
      </section>
    </div>
  );
}
