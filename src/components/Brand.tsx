import { Feather } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <div className="brand__mark" aria-hidden="true"><Feather size={25} strokeWidth={1.7} /></div>
      {!compact && <div className="brand__name">Редактура<br />«Дом Некроманта»</div>}
    </div>
  );
}
