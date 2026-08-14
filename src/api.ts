export type ApiWork = {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: string | null;
  translator: string | null;
  cover_url: string | null;
  chapters: number;
  verified_chapters: number;
  reading_progress: number;
  last_updated_at: string | null;
};

export type ApiChapter = {
  id: string;
  work_id: string;
  chapter_number: number;
  title: string;
  source_format: 'txt' | 'docx';
  source_modified_at: string;
  status: 'draft' | 'editing' | 'verified' | 'hidden';
  updated_at: string;
  progress_percent: number;
  suggestion_count: number;
};

export type ApiChapterDetail = ApiChapter & {
  source_hash: string;
  normalized_text: string;
  work_title: string;
  current_version_id: string | null;
};

export type ContributionStats = {
  submitted: number;
  accepted: number;
  pending: number;
};

export type ActivityItem = {
  id: string;
  event_type: string;
  created_at: string;
  telegram_username: string | null;
  display_name: string | null;
  work_title: string | null;
  chapter_number: number | null;
  chapter_title: string | null;
};

type ApiError = { error?: string };

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

export const editorApi = {
  async works(): Promise<ApiWork[]> {
    const data = await requestJson<{ works: ApiWork[] }>('/api/works');
    return data.works;
  },

  async chapters(workId: string): Promise<ApiChapter[]> {
    const data = await requestJson<{ chapters: ApiChapter[] }>(`/api/works/${encodeURIComponent(workId)}/chapters`);
    return data.chapters;
  },

  async chapter(chapterId: string): Promise<ApiChapterDetail> {
    const data = await requestJson<{ chapter: ApiChapterDetail }>(`/api/chapters/${encodeURIComponent(chapterId)}`);
    return data.chapter;
  },

  async contributionStats(): Promise<ContributionStats> {
    return requestJson<ContributionStats>('/api/me/stats');
  },

  async activity(): Promise<ActivityItem[]> {
    const data = await requestJson<{ activity: ActivityItem[] }>('/api/activity');
    return data.activity;
  },

  async saveReadingProgress(chapterId: string, progressPercent: number, scrollAnchor = ''): Promise<void> {
    await requestJson<{ ok: true }>('/api/reading-progress', {
      method: 'POST',
      body: JSON.stringify({ chapterId, progressPercent, scrollAnchor }),
    });
  },

  async submitSuggestion(input: {
    chapterId: string;
    chapterVersionId: string;
    category: 'typo' | 'punctuation' | 'style' | 'translation' | 'other';
    rangeStart: number;
    rangeEnd: number;
    originalText: string;
    suggestedText: string;
    comment: string;
  }): Promise<{ id: string; status: string }> {
    return requestJson<{ id: string; status: string }>('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
