import { ArrowRight, CheckCircle2, Clock3, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { editorApi, type ActivityItem, type ApiWork, type ContributionStats } from '../api';
import type { AuthUser } from '../types';

interface DashboardProps {
  user: AuthUser;
  onOpenWork: (workId: string) => void;
  onOpenProfile: () => void;
}

const emptyStats: ContributionStats = { submitted: 0, accepted: 0, pending: 0 };

function formatUpdated(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function activityText(item: ActivityItem): string {
  if (item.event_type === 'suggestion_created') {
    const chapter = item.chapter_number == null ? '' : `, глава ${item.chapter_number}`;
    return `предложил(а) правку в «${item.work_title ?? 'произведении'}»${chapter}`;
  }
  return 'выполнил(а) действие в редактуре';
}

export function Dashboard({ user, onOpenWork, onOpenProfile }: DashboardProps) {
  const [works, setWorks] = useState<ApiWork[]>([]);
  const [stats, setStats] = useState<ContributionStats>(emptyStats);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [nextWorks, nextStats, nextActivity] = await Promise.all([
          editorApi.works(),
          editorApi.contributionStats(),
          editorApi.activity(),
        ]);
        if (!cancelled) {
          setWorks(nextWorks);
          setStats(nextStats);
          setActivity(nextActivity);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить данные.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const continueWork = useMemo(
    () => works.find((work) => work.reading_progress > 0 && work.reading_progress < 100) ?? works[0] ?? null,
    [works],
  );
  const firstName = user.displayName.trim().split(/\s+/)[0] || user.displayName;

  return (
    <div className="page page--dashboard">
      <header className="page-heading">
        <div>
          <h1>Добрый вечер, {firstName}</h1>
          <p>Рады видеть вас в Доме Некроманта. Продолжайте делать истории лучше.</p>
        </div>
      </header>

      {error && <section className="card empty-state"><p>{error}</p></section>}

      <div className="dashboard-grid">
        <section className="card continue-card">
          <div className="section-title-row"><h2>Продолжить чтение</h2><span className="bookmark-mark">⌑</span></div>
          {loading ? (
            <p className="muted">Загружаем произведения…</p>
          ) : continueWork ? (
            <div className="continue-card__body">
              <div
                className="cover cover--large"
                aria-label={`Обложка ${continueWork.title}`}
                style={continueWork.cover_url ? { backgroundImage: `url(${continueWork.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {!continueWork.cover_url && <span>{continueWork.title}</span>}
              </div>
              <div className="continue-card__content">
                <h3>{continueWork.title}</h3>
                <p>{continueWork.chapters} глав · обновлено {formatUpdated(continueWork.last_updated_at)}</p>
                <div className="metric-label"><span>Прогресс чтения</span><strong>{continueWork.reading_progress}%</strong></div>
                <div className="progress"><span style={{ width: `${continueWork.reading_progress}%` }} /></div>
                <div className="metric-label metric-label--proof"><span>Прогресс вычитки</span><strong>{continueWork.chapters ? Math.round((continueWork.verified_chapters / continueWork.chapters) * 100) : 0}%</strong></div>
                <div className="proof-dots"><b /><b /><b /><i /><i /><i /><i /></div>
                <button className="button button--dark button--full" onClick={() => onOpenWork(continueWork.id)}>Продолжить</button>
              </div>
            </div>
          ) : (
            <p className="muted">Произведений пока нет. После синхронизации Google Drive они появятся здесь.</p>
          )}
        </section>

        <section className="card updates-card">
          <div className="section-title-row"><h2>Недавно обновлено</h2></div>
          {works.slice(0, 4).map((work) => (
            <button
              className="update-row"
              key={work.id}
              onClick={() => onOpenWork(work.id)}
              style={{ width: '100%', borderTop: 0, borderLeft: 0, borderRight: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
            >
              <div
                className="cover cover--thumb"
                style={work.cover_url ? { backgroundImage: `url(${work.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              />
              <div className="update-row__copy"><strong>{work.title}</strong><span>{work.chapters} глав</span><small>{formatUpdated(work.last_updated_at)}</small></div>
              <span className="pill">Проверено {work.chapters ? Math.round((work.verified_chapters / work.chapters) * 100) : 0}%</span>
              <ArrowRight size={18} />
            </button>
          ))}
          {!loading && works.length === 0 && <p className="muted">Нет синхронизированных произведений.</p>}
        </section>

        <section className="card contribution-card">
          <h2>Моя редактура</h2>
          <div className="stats-row">
            <div className="stat"><Send size={24} /><span>Отправлено</span><strong>{stats.submitted}</strong></div>
            <div className="stat"><CheckCircle2 size={24} /><span>Принято</span><strong>{stats.accepted}</strong></div>
            <div className="stat"><Clock3 size={24} /><span>На рассмотрении</span><strong>{stats.pending}</strong></div>
          </div>
          <p className="muted">Здесь учитываются реальные предложения, отправленные через читалку.</p>
          <button className="text-button" onClick={onOpenProfile}>Перейти к моим правкам <ArrowRight size={17} /></button>
        </section>

        <section className="card activity-card">
          <div className="section-title-row"><h2>Активность сообщества</h2></div>
          {activity.slice(0, 6).map((row) => {
            const actor = row.telegram_username ? `@${row.telegram_username}` : row.display_name || 'Участник';
            return (
              <div className="activity-row" key={row.id}>
                <div className="mini-avatar">{actor.replace(/^@/, '')[0]?.toUpperCase() ?? '?'}</div>
                <div><strong>{actor}</strong> {activityText(row)}<small>{formatUpdated(row.created_at)}</small></div>
                <ArrowRight size={18} />
              </div>
            );
          })}
          {!loading && activity.length === 0 && <p className="muted">Активность появится после первых предложений правок.</p>}
        </section>
      </div>
    </div>
  );
}
