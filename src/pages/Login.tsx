import { BookOpen, CircleCheck, LockKeyhole, PencilLine, Send, UsersRound } from 'lucide-react';
import { Brand } from '../components/Brand';
import './login.css';

interface LoginProps {
  configured: boolean;
  botUsername: string;
  deniedTelegramId?: string | null;
  loadError?: string | null;
}

const features = [
  { icon: BookOpen, label: 'Читайте главы' },
  { icon: CircleCheck, label: 'Отмечайте ошибки' },
  { icon: PencilLine, label: 'Предлагайте исправления' },
  { icon: UsersRound, label: 'Помогайте улучшать перевод' },
];

export function Login({ configured, botUsername, deniedTelegramId, loadError }: LoginProps) {
  return (
    <main className="login-page">
      <section className="login-copy">
        <div className="login-brand"><Brand /></div>
        <div className="login-rule"><span /></div>
        <h1>Частная площадка для<br />вычитки и редактуры переводов</h1>
        <p className="login-lead">
          Читайте новые главы, отмечайте ошибки, предлагайте исправления и помогайте нам делать переводы лучше.
        </p>

        <div className="login-features">
          {features.map(({ icon: Icon, label }) => (
            <div className="login-feature" key={label}>
              <Icon size={27} strokeWidth={1.55} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {deniedTelegramId && (
          <div className="login-notice login-notice--warning">
            <LockKeyhole size={18} />
            <div>
              <strong>Доступ пока не выдан.</strong>
              <span>Ваш Telegram ID: <code>{deniedTelegramId}</code>. Передайте его администратору для добавления в список доступа.</span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="login-notice login-notice--warning">
            <LockKeyhole size={18} />
            <div><strong>Не удалось проверить авторизацию.</strong><span>{loadError}</span></div>
          </div>
        )}

        <button
          className="login-button"
          type="button"
          disabled={!configured}
          onClick={() => { window.location.href = '/api/auth/start'; }}
        >
          <Send size={21} strokeWidth={1.8} />
          <span>Войти через Telegram</span>
        </button>

        <div className="login-private">
          <LockKeyhole size={18} strokeWidth={1.7} />
          {configured
            ? <>Доступ предоставляется только по приглашению через <strong>@{botUsername}</strong>.</>
            : <>Telegram Login ещё не настроен на сервере. Сначала нужно завершить production setup.</>}
        </div>
      </section>

      <aside className="login-atmosphere" aria-hidden="true">
        <div className="login-lamp" />
        <div className="login-books login-books--one" />
        <div className="login-books login-books--two" />
        <div className="login-paper">
          <div className="login-moon">☾</div>
          <span>Слово — ключ,<br />мы лишь помогаем<br />найти замок.</span>
        </div>
        <div className="login-book-open">
          <div /><div />
        </div>
        <div className="login-quill">❧</div>
      </aside>
    </main>
  );
}
