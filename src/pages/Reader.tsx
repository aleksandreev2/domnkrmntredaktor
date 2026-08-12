import { ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, Moon, PanelLeftOpen, Text, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { readerParagraphs } from '../data';

interface ReaderProps {
  onBack: () => void;
  onOpenMenu: () => void;
}

export function Reader({ onBack, onOpenMenu }: ReaderProps) {
  const [selected, setSelected] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [replacement, setReplacement] = useState('Он быстро надел куртку и вышел наружу.');
  const [comment, setComment] = useState('Одежду надевают, человека одевают.');
  const bodyClass = useMemo(() => `reader ${panelOpen ? 'reader--with-panel' : ''}`, [panelOpen]);

  return (
    <div className={bodyClass}>
      <header className="reader-topbar">
        <div className="reader-topbar__left">
          <button className="icon-button" onClick={onOpenMenu} aria-label="Открыть меню"><PanelLeftOpen size={21} /></button>
          <button className="reader-back" onClick={onBack}><ArrowLeft size={18} /> К произведению</button>
        </div>
        <div className="reader-topbar__right">
          <button className="reader-tool"><Text size={18} /><span>Шрифт</span></button>
          <button className="reader-tool"><Moon size={18} /><span>Тема</span></button>
          <button className="reader-tool"><span className="lines-icon">≡</span><span>Интервал</span></button>
        </div>
      </header>

      <main className="reader-main">
        <div className="reader-heading">
          <p className="reader-work">Призванный в другой мир</p>
          <h1>Глава 127. Непрошеный гость</h1>
          <div className="reader-navigation">
            <button><ChevronLeft size={18} /> Предыдущая глава</button>
            <div className="reader-progress"><span>Прогресс чтения</span><div className="progress"><i style={{ width: '68%' }} /></div><strong>68%</strong></div>
            <button>Следующая глава <ChevronRight size={18} /></button>
          </div>
        </div>

        <article className="chapter-text" onClick={() => selected && setSelected(false)}>
          {readerParagraphs.map((paragraph, index) => {
            if (index !== 3) return <p key={index}>{paragraph}</p>;
            return (
              <div className="selection-wrap" key={index} onClick={(event) => event.stopPropagation()}>
                <p><mark className={selected ? 'selected-text' : ''} onClick={() => setSelected(true)}>{paragraph}</mark></p>
                {selected && !panelOpen && (
                  <div className="selection-toolbar">
                    <button onClick={() => setPanelOpen(true)}>✒ <span>Предложить правку</span></button>
                    <button><MessageSquare size={16} /> <span>Комментарий</span></button>
                  </div>
                )}
              </div>
            );
          })}
        </article>
      </main>

      {panelOpen && (
        <aside className="correction-panel">
          <div className="correction-panel__header"><h2>Предложить правку</h2><button className="icon-button" onClick={() => setPanelOpen(false)}><X size={20} /></button></div>
          <label>Оригинал</label>
          <div className="diff-box">Он быстро <del>одел</del> куртку и вышел наружу.</div>
          <label>Предложенный вариант</label>
          <textarea value={replacement} onChange={(e) => setReplacement(e.target.value)} rows={3} />
          <label>Тип замечания</label>
          <select defaultValue="style"><option value="typo">Опечатка</option><option value="punctuation">Пунктуация</option><option value="style">Стилистика</option><option value="translation">Неточность перевода</option><option value="other">Другое</option></select>
          <label>Комментарий</label>
          <div className="textarea-wrap"><textarea maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} rows={4} /><span>{comment.length}/500</span></div>
          <p className="panel-note">После отправки предложение появится в очереди редакторов.</p>
          <div className="panel-actions"><button className="button button--soft" onClick={() => setPanelOpen(false)}>Отмена</button><button className="button button--dark">Отправить предложение</button></div>
        </aside>
      )}
    </div>
  );
}
