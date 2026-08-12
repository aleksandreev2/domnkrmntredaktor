export type NavKey = 'home' | 'works' | 'edits' | 'activity' | 'moderation' | 'users' | 'settings' | 'profile';

export type UserRole = 'reader' | 'editor' | 'admin';

export interface AuthUser {
  id: string;
  telegramId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'stale';

export interface Work {
  id: string;
  title: string;
  description: string;
  author: string;
  translator: string;
  chapters: number;
  proofreadingProgress: number;
  readingProgress: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  readingStatus: 'read' | 'reading' | 'unread';
  proofreadingStatus: 'verified' | 'editing' | 'suggestions' | 'unread';
  suggestions: number;
  updated: string;
}

export interface Suggestion {
  id: string;
  user: string;
  work: string;
  chapter: string;
  type: string;
  before: string;
  after: string;
  comment: string;
  status: SuggestionStatus;
  createdAt: string;
}
