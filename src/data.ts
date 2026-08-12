import type { Chapter, Suggestion, Work } from './types';

export const mainWork: Work = {
  id: 'summoned',
  title: 'Призванный в другой мир',
  description: 'Обычный парень оказывается перенесён в жестокий мир магии и теней, где каждое решение может стать последним.',
  author: 'К. М. Воронцов',
  translator: 'Алекс',
  chapters: 187,
  proofreadingProgress: 57,
  readingProgress: 68,
};

export const chapters: Chapter[] = [
  { id: '123', number: 123, title: 'Тихий коридор', readingStatus: 'read', proofreadingStatus: 'verified', suggestions: 8, updated: 'вчера' },
  { id: '124', number: 124, title: 'След на снегу', readingStatus: 'read', proofreadingStatus: 'verified', suggestions: 5, updated: 'вчера' },
  { id: '125', number: 125, title: 'Старый договор', readingStatus: 'read', proofreadingStatus: 'suggestions', suggestions: 12, updated: '2 д. назад' },
  { id: '126', number: 126, title: 'После полуночи', readingStatus: 'read', proofreadingStatus: 'editing', suggestions: 7, updated: '2 д. назад' },
  { id: '127', number: 127, title: 'Непрошеный гость', readingStatus: 'reading', proofreadingStatus: 'editing', suggestions: 9, updated: '2 ч. назад' },
  { id: '128', number: 128, title: 'Цена доверия', readingStatus: 'unread', proofreadingStatus: 'unread', suggestions: 4, updated: '—' },
  { id: '129', number: 129, title: 'Тени прошлого', readingStatus: 'unread', proofreadingStatus: 'unread', suggestions: 3, updated: '—' },
  { id: '130', number: 130, title: 'Дорога в никуда', readingStatus: 'unread', proofreadingStatus: 'unread', suggestions: 2, updated: '—' },
];

export const suggestions: Suggestion[] = [
  { id: 's1', user: '@alex', work: 'Призванный в другой мир', chapter: 'Глава 127. Непрошеный гость', type: 'Стилистика', before: 'одел', after: 'надел', comment: 'Одежду надевают, человека одевают.', status: 'pending', createdAt: '12 минут назад' },
  { id: 's2', user: '@mira', work: 'Северный обет', chapter: 'Глава 203. След на снегу', type: 'Пунктуация', before: '«вернись»,', after: '«вернись».', comment: 'После прямой речи нужна точка.', status: 'pending', createdAt: '25 минут назад' },
  { id: 's3', user: '@vera', work: 'Дом пепла', chapter: 'Глава 58. Тихий коридор', type: 'Неточность перевода', before: 'steel door', after: 'стальная дверь', comment: 'Буквальный перевод теряет смысл.', status: 'pending', createdAt: '43 минуты назад' },
  { id: 's4', user: '@roman', work: 'Пепельный архив', chapter: 'Глава 14. Под печатью', type: 'Опечатка', before: 'преследувал', after: 'преследовал', comment: 'Пропущена буква «о».', status: 'pending', createdAt: '1 час назад' },
];

export const readerParagraphs = [
  'Снег шёл уже третий час. Крупные хлопья медленно кружились в свете редких фонарей, ложась на крыши домов и мостовую тяжёлым белым покрывалом. Город затих, словно затаился в ожидании чего-то неизбежного.',
  'Арлен стоял у окна на втором этаже постоялого двора и смотрел на узкую улочку, ведущую к окраине. Там, в старом районе, где каменные дома теснились друг к другу, он чувствовал присутствие — едва уловимое, но настойчивое.',
  'На столе перед ним лежал пергамент с кривыми строчками — донесение стражи. Несколько пропавших за последнюю неделю, странные следы у запертых дверей, шёпот о тенях в переулках. Всё это сходилось к одному имени.',
  'Он быстро одел куртку и вышел наружу.',
  'Холод ударил в лицо, стоило только переступить порог. Арлен поднял воротник и зашагал по скрипучему снегу, вдыхая терпкий воздух зимней ночи.',
  'Улица была пуста. Только где-то вдали тявкнула собака и снова умолкла. Фонари мигали, словно боролись со тьмой, но свет их был слаб, и тени прятались между домами.',
  'Старый особняк стоял в конце переулка — мрачный, с заколоченными ставнями и покосившейся крышей. Когда-то здесь жил ремесленник, потом торговец, а теперь — никто. Или, может быть, почти никто.',
  'Арлен подошёл к двери и замер на миг, прислушиваясь. Изнутри не доносилось ни звука. Он кивнул сам себе, достал отмычку и бесшумно откинул засов.',
];
