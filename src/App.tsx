import { useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Moderation } from './pages/Moderation';
import { Profile } from './pages/Profile';
import { Reader } from './pages/Reader';
import { WorkDetail } from './pages/WorkDetail';
import type { NavKey } from './types';

type View = NavKey | 'reader';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigate = (key: NavKey) => setView(key);

  if (view === 'reader') {
    return (
      <>
        <Reader onBack={() => setView('works')} onOpenMenu={() => setDrawerOpen(true)} />
        {drawerOpen && (
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
            <div onClick={(event) => event.stopPropagation()}>
              <Sidebar active="works" onNavigate={navigate} overlay onClose={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar active={view as NavKey} onNavigate={navigate} />
      <div className="app-content">
        <AppHeader />
        {view === 'home' && <Dashboard onOpenWork={() => setView('works')} onOpenProfile={() => setView('profile')} />}
        {view === 'works' && <WorkDetail onRead={() => setView('reader')} />}
        {view === 'moderation' && <Moderation />}
        {view === 'profile' && <Profile />}
        {!['home', 'works', 'moderation', 'profile'].includes(view) && (
          <div className="page"><section className="card empty-state"><h1>Раздел в разработке</h1><p>Каркас навигации уже готов. Этот раздел подключим после основного вертикального сценария чтения и модерации.</p></section></div>
        )}
      </div>
    </div>
  );
}
