import { beginTelegramLogin, finishTelegramLogin, getSessionUser, isTelegramConfigured, logout } from './auth';
import { callDriveBridge } from './driveBridge';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function routeParts(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function sameOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin.replace(/\/$/, '') === env.APP_ORIGIN.replace(/\/$/, ''));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'domnkrmntredaktor', time: new Date().toISOString() });
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/config') {
      return json({
        configured: isTelegramConfigured(env),
        botUsername: env.TELEGRAM_BOT_USERNAME ?? 'domnekromantabot',
        loginUrl: '/api/auth/start',
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/start') {
      try {
        return await beginTelegramLogin(env);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Telegram login is unavailable' }, 503);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/callback') {
      try {
        return await finishTelegramLogin(request, env);
      } catch (error) {
        console.error('Telegram callback failed', error);
        return new Response('Telegram login failed', { status: 502 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const user = await getSessionUser(request, env);
      return user ? json({ user }) : json({ user: null }, 401);
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      if (!sameOrigin(request, env)) return json({ error: 'Invalid origin' }, 403);
      return logout(request, env);
    }

    const user = await getSessionUser(request, env);
    if (!user) return json({ error: 'Authentication required' }, 401);

    if (url.pathname === '/api/drive/health') {
      if (user.role !== 'admin') return json({ error: 'Admin access required' }, 403);
      try {
        const result = await callDriveBridge(env, 'ping');
        return json({ ok: true, bridge: result });
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown bridge error' }, 503);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/works') {
      const { results } = await env.DB.prepare(
        'SELECT id, slug, title, description, author, translator, source_folder_id, created_at, updated_at FROM works WHERE is_archived = 0 ORDER BY title',
      ).all();
      return json({ works: results });
    }

    const parts = routeParts(url.pathname);
    if (request.method === 'GET' && parts.length === 4 && parts[0] === 'api' && parts[1] === 'works' && parts[3] === 'chapters') {
      const workId = parts[2];
      const { results } = await env.DB.prepare(
        'SELECT id, work_id, chapter_number, title, source_file_id, source_format, source_hash, source_modified_at, status FROM chapters WHERE work_id = ? ORDER BY chapter_number',
      ).bind(workId).all();
      return json({ chapters: results });
    }

    if (request.method === 'GET' && url.pathname === '/api/moderation/suggestions') {
      if (user.role !== 'admin') return json({ error: 'Admin access required' }, 403);
      const { results } = await env.DB.prepare(`
        SELECT s.id, s.status, s.category, s.original_text, s.suggested_text, s.comment, s.created_at,
               c.chapter_number, c.title AS chapter_title, w.title AS work_title,
               u.telegram_username, u.display_name
        FROM suggestions s
        JOIN chapters c ON c.id = s.chapter_id
        JOIN works w ON w.id = c.work_id
        JOIN users u ON u.id = s.user_id
        ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC
        LIMIT 100
      `).all();
      return json({ suggestions: results });
    }

    if (request.method === 'POST' && url.pathname === '/api/suggestions') {
      if (!sameOrigin(request, env)) return json({ error: 'Invalid origin' }, 403);
      const body = await request.json().catch(() => null) as null | {
        chapterId?: string;
        chapterVersionId?: string;
        category?: string;
        rangeStart?: number;
        rangeEnd?: number;
        originalText?: string;
        suggestedText?: string;
        comment?: string;
      };
      if (!body) return json({ error: 'Invalid JSON' }, 400);

      const categories = new Set(['typo', 'punctuation', 'style', 'translation', 'other']);
      if (!body.chapterId || !body.chapterVersionId || !body.category || !categories.has(body.category)) {
        return json({ error: 'Invalid suggestion metadata' }, 400);
      }
      if (!Number.isInteger(body.rangeStart) || !Number.isInteger(body.rangeEnd) || (body.rangeStart ?? -1) < 0 || (body.rangeEnd ?? -1) < (body.rangeStart ?? 0)) {
        return json({ error: 'Invalid text range' }, 400);
      }
      if (typeof body.originalText !== 'string' || typeof body.suggestedText !== 'string' || !body.originalText || !body.suggestedText) {
        return json({ error: 'Original and suggested text are required' }, 400);
      }
      if (body.originalText.length > 10000 || body.suggestedText.length > 10000 || (body.comment?.length ?? 0) > 2000) {
        return json({ error: 'Suggestion is too large' }, 413);
      }

      const version = await env.DB.prepare(`
        SELECT cv.normalized_text AS version_text, cv.source_hash AS version_hash, c.source_hash AS current_hash
        FROM chapter_versions cv
        JOIN chapters c ON c.id = cv.chapter_id
        WHERE cv.id = ? AND c.id = ?
      `).bind(body.chapterVersionId, body.chapterId).first<{
        version_text: string;
        version_hash: string;
        current_hash: string;
      }>();
      if (!version) return json({ error: 'Chapter version not found' }, 404);

      const start = body.rangeStart as number;
      const end = body.rangeEnd as number;
      if (end > version.version_text.length || version.version_text.slice(start, end) !== body.originalText) {
        return json({ error: 'Selected text no longer matches this chapter version' }, 409);
      }

      const status = version.version_hash === version.current_hash ? 'pending' : 'stale';
      const suggestionId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO suggestions (
          id, chapter_id, chapter_version_id, user_id, category, range_start, range_end,
          original_text, suggested_text, comment, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        suggestionId,
        body.chapterId,
        body.chapterVersionId,
        user.id,
        body.category,
        start,
        end,
        body.originalText,
        body.suggestedText,
        body.comment ?? '',
        status,
      ).run();

      return json({ id: suggestionId, status }, 201);
    }

    return json({ error: 'Not found' }, 404);
  },
};
