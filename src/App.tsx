import { useCallback, useEffect, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Moderation } from './pages/Moderation';
import { Profile } from './pages/Profile';
import { Reader } from './pages/Reader';
import { WorkDetail } from './pages/WorkDetail';
import type { AuthUser, NavKey } from './types';

type View = NavKey | 'reader';

type AuthState = {
  loading: boolean;
  user: AuthUser | null;
  configured: boolean;
  botUsername: string;
  error: string | null;
};

export default function App() {
  const [view, setView] = useState<View>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>({
    loading: true,
    user: null,
    configured: false,
    botUsername: 'domnekromanta_bot',
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const configResponse = await fetch('/api/auth/config', { credentials: 'same-origin' });
        if (!configResponse.ok) throw new Error('Сервер авторизации недоступен.');
        const config = await configResponse.json() as { configured?: boolean; botUsername?: string };

        const meResponse = await fetch('/api/auth/me', { credentials: 'same-origin' });
        let user: AuthUser | null = null;
        if (meResponse.ok) {
          const data = await meResponse.json() as { user?: AuthUser };
          user = data.user ?? null;
        }

        if (!cancelled) {
          setAuth({
            loading: false,
            user,
            configured: Boolean(config.configured),
            botUsername: config.botUsername || 'domnekromanta_bot',
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setAuth((current) => ({
            ...current,
            loading: false,
            user: null,
            error: error instanceof Error ? error.message : 'Не удалось загрузить приложение.',
          }));
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const resolveWork = useCallback((workId: string) => {
    setSelectedWorkId((current) => current === workId ? current : workId);
  }, []);

  if (auth.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#77746d' }}>
        Проверяем доступ…
      </div>
    );
  }

  if (!auth.user) {
    const params = new URLSearchParams(window.location.search);
    return (
      <Login
        configured={auth.configured}
        botUsername={auth.botUsername}
        deniedTelegramId={params.get('auth') === 'denied' ? params.get('telegram_id') : null}
        loadError={auth.error}
      />
    );
  }

  const navigate = (key: NavKey) => {
    if ((key === 'moderation' || key === 'users') && auth.user?.role !== 'admin') {
      setView('home');
      return;
    }
    setView(key);
  };

  const openWork = (workId: string) => {
    setSelectedWorkId(workId);
    setView('works');
  };

  const openChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setView('reader');
  };

  if (view === 'reader') {
    return (
      <>
        <Reader
          chapterId={selectedChapterId}
          onBack={() => setView('works')}
          onOpenMenu={() => setDrawerOpen(true)}
          onOpenChapter={openChapter}
        />
        {drawerOpen && (
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
            <div onClick={(event) => event.stopPropagation()}>
              <Sidebar active="works" role={auth.user.role} onNavigate={navigate} overlay onClose={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar active={view as NavKey} role={auth.user.role} onNavigate={navigate} />
      <div className="app-content">
        <AppHeader user={auth.user} onOpenProfile={() => setView('profile')} />
        {view === 'home' && <Dashboard user={auth.user} onOpenWork={openWork} onOpenProfile={() => setView('profile')} />}
        {view === 'works' && <WorkDetail workId={selectedWorkId} onResolveWork={resolveWork} onRead={openChapter} />}
        {view === 'moderation' && auth.user.role === 'admin' && <Moderation />}
        {view === 'profile' && <Profile />}
        {!['home', 'works', 'moderation', 'profile'].includes(view) && (
          <div className="page"><section className="card empty-state"><h1>Раздел в разработке</h1><p>Каркас навигации уже готов. Этот раздел подключим после основного вертикального сценария чтения и модерации.</p></section></div>
        )}
      </div>
    </div>
  );
}
