import { ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, Moon, PanelLeftOpen, Text, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { editorApi, type ApiChapter, type ApiChapterDetail } from '../api';

interface ReaderProps {
  chapterId: string | null;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenChapter: (chapterId: string) => void;
}

type SuggestionCategory = 'typo' | 'punctuation' | 'style' | 'translation' | 'other';

type TextSelection = {
  text: string;
  start: number;
  end: number;
  paragraphIndex: number;
};

type ParagraphSegment = {
  text: string;
  start: number;
};

function paragraphSegments(source: string): ParagraphSegment[] {
  const text = source.replace(/\r\n/g, '\n');
  const blocks = text.split(/\n{2,}/);
  const result: ParagraphSegment[] = [];
  let cursor = 0;

  for (const block of blocks) {
    const foundAt = text.indexOf(block, cursor);
    const trimmed = block.trim();
    if (trimmed) {
      const trimOffset = block.indexOf(trimmed);
      result.push({ text: trimmed, start: Math.max(0, foundAt) + Math.max(0, trimOffset) });
    }
    cursor = Math.max(cursor, Math.max(0, foundAt) + block.length);
  }
  return result;
}

function chapterTitle(chapter: ApiChapterDetail): string {
  return `Глава ${chapter.chapter_number}. ${chapter.title}`;
}

export function Reader({ chapterId, onBack, onOpenMenu, onOpenChapter }: ReaderProps) {
  const [chapter, setChapter] = useState<ApiChapterDetail | null>(null);
  const [chapterList, setChapterList] = useState<ApiChapter[]>([]);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [category, setCategory] = useState<SuggestionCategory>('style');
  const [comment, setComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyClass = useMemo(() => `reader ${panelOpen ? 'reader--with-panel' : ''}`, [panelOpen]);
  const paragraphs = useMemo(() => paragraphSegments(chapter?.normalized_text ?? ''), [chapter?.normalized_text]);

  useEffect(() => {
    if (!chapterId) {
      setLoading(false);
      setChapter(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSelection(null);
    setPanelOpen(false);
    setNotice(null);
    setError(null);

    const load = async () => {
      try {
        const nextChapter = await editorApi.chapter(chapterId);
        if (cancelled) return;
        setChapter(nextChapter);
        setProgress(Number(nextChapter.progress_percent || 0));
        const list = await editorApi.chapters(nextChapter.work_id);
        if (!cancelled) setChapterList(list);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить главу.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [chapterId]);

  useEffect(() => {
    if (!chapterId || !chapter) return;
    let highest = Number(chapter.progress_percent || 0);
    let saveTimer: number | undefined;

    const updateProgress = () => {
      const root = document.documentElement;
      const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
      const measured = maxScroll === 0 ? 100 : Math.round((window.scrollY / maxScroll) * 100);
      const next = Math.max(highest, Math.min(100, Math.max(0, measured)));
      if (next <= highest) return;
      highest = next;
      setProgress(next);
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        void editorApi.saveReadingProgress(chapterId, next, String(Math.round(window.scrollY))).catch(() => undefined);
      }, 500);
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    const initialTimer = window.setTimeout(updateProgress, 100);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.clearTimeout(initialTimer);
      if (saveTimer) window.clearTimeout(saveTimer);
      void editorApi.saveReadingProgress(chapterId, highest, String(Math.round(window.scrollY))).catch(() => undefined);
    };
  }, [chapterId, chapter]);

  const currentIndex = chapter ? chapterList.findIndex((item) => item.id === chapter.id) : -1;
  const previousChapter = currentIndex > 0 ? chapterList[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1] : null;

  const captureSelection = (article: HTMLElement) => {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.rangeCount === 0 || browserSelection.isCollapsed) return;
    const range = browserSelection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as Element
      : range.commonAncestorContainer.parentElement;
    const paragraph = ancestor?.closest<HTMLParagraphElement>('p[data-text-start]');
    if (!paragraph || !article.contains(paragraph) || !paragraph.contains(range.startContainer) || !paragraph.contains(range.endContainer)) {
      setSelection(null);
      return;
    }

    const localStartRange = document.createRange();
    localStartRange.selectNodeContents(paragraph);
    localStartRange.setEnd(range.startContainer, range.startOffset);
    const localEndRange = document.createRange();
    localEndRange.selectNodeContents(paragraph);
    localEndRange.setEnd(range.endContainer, range.endOffset);

    const originalText = range.toString();
    if (!originalText.trim()) return;
    const paragraphStart = Number(paragraph.dataset.textStart ?? 0);
    const start = paragraphStart + localStartRange.toString().length;
    const end = paragraphStart + localEndRange.toString().length;
    const paragraphIndex = Number(paragraph.dataset.paragraphIndex ?? 0);

    const nextSelection = { text: originalText, start, end, paragraphIndex };
    setSelection(nextSelection);
    setReplacement(originalText);
    setNotice(null);
  };

  const openCorrectionPanel = () => {
    if (!selection) return;
    setPanelOpen(true);
    setReplacement(selection.text);
  };

  const submitSuggestion = async () => {
    if (!chapter || !selection || !chapter.current_version_id) {
      setNotice('У этой главы нет активной версии для правки. Сначала синхронизируйте источник.');
      return;
    }
    if (!replacement.trim()) {
      setNotice('Предложенный вариант не может быть пустым.');
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const result = await editorApi.submitSuggestion({
        chapterId: chapter.id,
        chapterVersionId: chapter.current_version_id,
        category,
        rangeStart: selection.start,
        rangeEnd: selection.end,
        originalText: selection.text,
        suggestedText: replacement,
        comment,
      });
      setNotice(result.status === 'stale'
        ? 'Предложение сохранено, но исходная версия главы уже устарела.'
        : 'Предложение отправлено редакторам.');
      setPanelOpen(false);
      setSelection(null);
      setComment('');
    } catch (submitError) {
      setNotice(submitError instanceof Error ? submitError.message : 'Не удалось отправить предложение.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="reader"><main className="reader-main"><section className="card empty-state"><p>Загружаем главу…</p></section></main></div>;
  }

  if (!chapter) {
    return <div className="reader"><main className="reader-main"><section className="card empty-state"><h1>Глава недоступна</h1><p>{error ?? 'Выберите главу в произведении.'}</p><button className="button button--dark" onClick={onBack}>К произведению</button></section></main></div>;
  }

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
          <p className="reader-work">{chapter.work_title}</p>
          <h1>{chapterTitle(chapter)}</h1>
          <div className="reader-navigation">
            <button disabled={!previousChapter} onClick={() => previousChapter && onOpenChapter(previousChapter.id)}><ChevronLeft size={18} /> Предыдущая глава</button>
            <div className="reader-progress"><span>Прогресс чтения</span><div className="progress"><i style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div>
            <button disabled={!nextChapter} onClick={() => nextChapter && onOpenChapter(nextChapter.id)}>Следующая глава <ChevronRight size={18} /></button>
          </div>
          {(notice || error) && <p className="muted">{notice ?? error}</p>}
        </div>

        <article className="chapter-text" onMouseUp={(event) => captureSelection(event.currentTarget)}>
          {paragraphs.map((paragraph, index) => {
            const content = <p data-text-start={paragraph.start} data-paragraph-index={index}>{paragraph.text}</p>;
            if (selection?.paragraphIndex !== index) return <div key={`${paragraph.start}-${index}`}>{content}</div>;
            return (
              <div className="selection-wrap" key={`${paragraph.start}-${index}`}>
                {content}
                {selection && !panelOpen && (
                  <div className="selection-toolbar">
                    <button onClick={openCorrectionPanel}>✒ <span>Предложить правку</span></button>
                    <button onClick={openCorrectionPanel}><MessageSquare size={16} /> <span>Комментарий</span></button>
                  </div>
                )}
              </div>
            );
          })}
        </article>
      </main>

      {panelOpen && selection && (
        <aside className="correction-panel">
          <div className="correction-panel__header"><h2>Предложить правку</h2><button className="icon-button" onClick={() => setPanelOpen(false)}><X size={20} /></button></div>
          <label>Оригинал</label>
          <div className="diff-box">{selection.text}</div>
          <label>Предложенный вариант</label>
          <textarea value={replacement} onChange={(event) => setReplacement(event.target.value)} rows={3} />
          <label>Тип замечания</label>
          <select value={category} onChange={(event) => setCategory(event.target.value as SuggestionCategory)}>
            <option value="typo">Опечатка</option>
            <option value="punctuation">Пунктуация</option>
            <option value="style">Стилистика</option>
            <option value="translation">Неточность перевода</option>
            <option value="other">Другое</option>
          </select>
          <label>Комментарий</label>
          <div className="textarea-wrap"><textarea maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} rows={4} /><span>{comment.length}/500</span></div>
          <p className="panel-note">После отправки предложение появится в очереди редакторов.</p>
          <div className="panel-actions"><button className="button button--soft" onClick={() => setPanelOpen(false)}>Отмена</button><button className="button button--dark" disabled={submitting} onClick={() => void submitSuggestion()}>{submitting ? 'Отправляем…' : 'Отправить предложение'}</button></div>
        </aside>
      )}
    </div>
  );
}
