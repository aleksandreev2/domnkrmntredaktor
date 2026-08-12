import { Bell } from 'lucide-react';
import type { AuthUser } from '../types';

interface AppHeaderProps {
  user: AuthUser;
  onOpenProfile?: () => void;
}

export function AppHeader({ user, onOpenProfile }: AppHeaderProps) {
  const fallback = user.displayName.trim().charAt(0).toUpperCase() || 'U';
  return (
    <div className="app-header__actions">
      <button className="icon-button notification-button" aria-label="Уведомления"><Bell size={22} strokeWidth={1.8} /><span /></button>
      <button className="avatar" aria-label={`Профиль ${user.displayName}`} onClick={onOpenProfile}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : fallback}
      </button>
    </div>
  );
}
