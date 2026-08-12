import { CheckCircle2, Clock3, Filter, Hourglass, Search, XCircle } from 'lucide-react';
import { suggestions } from '../data';

export function Moderation() {
  return (
    <div className="page">
      <header className="page-heading"><div><h1>Модерация</h1><p>Просматривайте и обрабатывайте правки, предложенные сообществом.</p></div></header>
      <div className="moderation-tabs card">
        <button className="is-active"><Clock3 size={20} />На рассмотрении — 17</button>
        <button><CheckCircle2 size={20} />Принято — 43</button>
        <button><XCircle size={20} />Отклонено — 8</button>
        <button><Hourglass size={20} />Устарело — 3</button>
      </div>
      <div className="filters card">
        <label><Search size={18} /><input placeholder="Поиск правок" /></label>
        <button>Произведение⌄</button><button>Глава⌄</button><button>Пользователь⌄</button><button>Тип ошибки⌄</button><button><Filter size={18} /> Фильтры</button>
      </div>
      <div className="moderation-list">
        {suggestions.map((item) => (
          <article className="moderation-row card" key={item.id}>
            <div className="reviewer"><div className="mini-avatar">{item.user[1]?.toUpperCase()}</div><div><strong>{item.user}</strong><span>{item.createdAt}</span></div></div>
            <div><strong>{item.work}</strong><span>{item.chapter}</span></div>
            <div><small>Тип ошибки</small><span className="type-pill">{item.type}</span></div>
            <div><small>Изменение</small><div className="inline-diff"><del>{item.before}</del><b>→</b><ins>{item.after}</ins></div></div>
            <div><small>Комментарий автора</small><p>{item.comment}</p></div>
            <div className="moderation-actions"><button className="button button--gold">Принять</button><button className="button button--soft">Отклонить</button><button className="text-button">Подробнее ›</button></div>
          </article>
        ))}
      </div>
    </div>
  );
}
