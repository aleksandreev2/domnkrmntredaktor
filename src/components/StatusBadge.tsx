import type { SuggestionStatus } from '../types';

export function StatusBadge({ status }: { status: SuggestionStatus }) {
  const map: Record<SuggestionStatus, string> = {
    pending: 'На рассмотрении',
    accepted: 'Принято',
    rejected: 'Отклонено',
    stale: 'Устарело',
  };
  return <span className={`status-badge status-badge--${status}`}>{map[status]}</span>;
}
