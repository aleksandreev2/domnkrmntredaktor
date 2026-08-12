import { Bell } from 'lucide-react';

export function AppHeader() {
  return (
    <div className="app-header__actions">
      <button className="icon-button notification-button" aria-label="Уведомления"><Bell size={22} strokeWidth={1.8} /><span /></button>
      <button className="avatar" aria-label="Профиль Алекса">A</button>
    </div>
  );
}
