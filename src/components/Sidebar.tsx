import {
  Activity,
  BookOpen,
  FilePenLine,
  Home,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import type { NavKey } from '../types';
import { Brand } from './Brand';

interface SidebarProps {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  overlay?: boolean;
  onClose?: () => void;
}

const primary = [
  { key: 'home' as const, label: 'Главная', icon: Home },
  { key: 'works' as const, label: 'Произведения', icon: BookOpen },
  { key: 'edits' as const, label: 'Мои правки', icon: FilePenLine },
  { key: 'activity' as const, label: 'Активность', icon: Activity },
];

const admin = [
  { key: 'moderation' as const, label: 'Модерация', icon: ShieldCheck },
  { key: 'users' as const, label: 'Пользователи', icon: UsersRound },
];

export function Sidebar({ active, onNavigate, overlay = false, onClose }: SidebarProps) {
  const navigate = (key: NavKey) => {
    onNavigate(key);
    onClose?.();
  };

  return (
    <aside className={`sidebar ${overlay ? 'sidebar--overlay' : ''}`}>
      <div className="sidebar__top">
        <Brand />
        {overlay && (
          <button className="icon-button sidebar__close" onClick={onClose} aria-label="Закрыть меню">
            <X size={20} />
          </button>
        )}
      </div>
      <nav className="sidebar__nav" aria-label="Основная навигация">
        {primary.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`nav-item ${active === key ? 'is-active' : ''}`} onClick={() => navigate(key)}>
            <Icon size={21} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
        <div className="sidebar__section-label">Администрирование</div>
        {admin.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`nav-item ${active === key ? 'is-active' : ''}`} onClick={() => navigate(key)}>
            <Icon size={21} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar__bottom">
        <button className={`nav-item ${active === 'settings' ? 'is-active' : ''}`} onClick={() => navigate('settings')}>
          <Settings size={21} strokeWidth={1.8} /><span>Настройки</span>
        </button>
        <button className={`nav-item ${active === 'profile' ? 'is-active' : ''}`} onClick={() => navigate('profile')}>
          <UserRound size={21} strokeWidth={1.8} /><span>Профиль</span>
        </button>
      </div>
    </aside>
  );
}
