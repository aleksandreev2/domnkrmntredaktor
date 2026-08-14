import { beginTelegramLogin, finishTelegramLogin, getSessionUser, isTelegramConfigured, logout } from './auth';
import { callDriveBridge } from './driveBridge';
import { syncDrive } from './sync';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function routeParts(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
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
        return await beginTelegramLogin(request, env);
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
      if (!sameOrigin(request)) return json({ error: 'Invalid origin' }, 403);
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

    if (request.method === 'POST' && url.pathname === '/api/admin/sync') {
      if (user.role !== 'admin') return json({ error: 'Admin access required' }, 403);
      if (!sameOrigin(request)) return json({ error: 'Invalid origin' }, 403);
      try {
        return json({ ok: true, stats: await syncDrive(env) });
      } catch (error) {
        console.error('Drive sync failed', error);
        return json({ ok: false, error: error instanceof Error ? error.message : 'Drive sync failed' }, 502);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/sync/status') {
      if (user.role !== 'admin') return json({ error: 'Admin access required' }, 403);
      const state = await env.DB.prepare("SELECT value, updated_at FROM sync_state WHERE key = 'drive_last_sync'")
        .first<{ value: string; updated_at: string }>();
      return json({
        lastSync: state ? { ...JSON.parse(state.value), persistedAt: state.updated_at } : null,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/works') {
      const { results } = await env.DB.prepare(`
        SELECT w.id, w.slug, w.title, w.description, w.author, w.translator, w.cover_url,
               COUNT(c.id) AS chapters,
               COALESCE(SUM(CASE WHEN c.status = 'verified' THEN 1 ELSE 0 END), 0) AS verified_chapters,
               COALESCE(ROUND(AVG(COALESCE(rp.progress_percent, 0))), 0) AS reading_progress,
               MAX(COALESCE(c.source_modified_at, w.updated_at)) AS last_updated_at
        FROM works w
        LEFT JOIN chapters c ON c.work_id = w.id AND c.status != 'hidden'
        LEFT JOIN reading_progress rp ON rp.chapter_id = c.id AND rp.user_id = ?
        WHERE w.is_archived = 0
        GROUP BY w.id, w.slug, w.title, w.description, w.author, w.translator, w.cover_url
        ORDER BY last_updated_at DESC, w.title
      `).bind(user.id).all();
      return json({ works: results });
    }

    if (request.method === 'GET' && url.pathname === '/api/me/stats') {
      const row = await env.DB.prepare(`
        SELECT COUNT(*) AS submitted,
               COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0) AS accepted,
               COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
        FROM suggestions
        WHERE user_id = ?
      `).bind(user.id).first<{ submitted: number; accepted: number; pending: number }>();
      return json({
        submitted: Number(row?.submitted ?? 0),
        accepted: Number(row?.accepted ?? 0),
        pending: Number(row?.pending ?? 0),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/activity') {
      const { results } = await env.DB.prepare(`
        SELECT a.id, a.event_type, a.created_at,
               u.telegram_username, u.display_name,
               w.title AS work_title,
               c.chapter_number, c.title AS chapter_title
        FROM activity a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN works w ON w.id = a.work_id
        LEFT JOIN chapters c ON c.id = a.chapter_id
        ORDER BY a.created_at DESC
        LIMIT 20
      `).all();
      return json({ activity: results });
    }

    const parts = routeParts(url.pathname);
    if (request.method === 'GET' && parts.length === 4 && parts[0] === 'api' && parts[1] === 'works' && parts[3] === 'chapters') {
      const workId = parts[2];
      const { results } = await env.DB.prepare(`
        SELECT c.id, c.work_id, c.chapter_number, c.title, c.source_format, c.source_modified_at,
               c.status, c.updated_at,
               COALESCE(rp.progress_percent, 0) AS progress_percent,
               (SELECT COUNT(*) FROM suggestions s
                WHERE s.chapter_id = c.id AND s.status IN ('pending', 'accepted')) AS suggestion_count
        FROM chapters c
        LEFT JOIN reading_progress rp ON rp.chapter_id = c.id AND rp.user_id = ?
        WHERE c.work_id = ? AND c.status != 'hidden'
        ORDER BY c.chapter_number
      `).bind(user.id, workId).all();
      return json({ chapters: results });
    }

    if (request.method === 'GET' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'chapters') {
      const chapterId = parts[2];
      const chapter = await env.DB.prepare(`
        SELECT c.id, c.work_id, c.chapter_number, c.title, c.source_format, c.source_hash,
               c.source_modified_at, c.normalized_text, c.status, c.updated_at,
               w.title AS work_title,
               COALESCE(rp.progress_percent, 0) AS progress_percent,
               (SELECT COUNT(*) FROM suggestions s
                WHERE s.chapter_id = c.id AND s.status IN ('pending', 'accepted')) AS suggestion_count,
               (SELECT cv.id FROM chapter_versions cv
                WHERE cv.chapter_id = c.id AND cv.source_hash = c.source_hash
                ORDER BY cv.created_at DESC LIMIT 1) AS current_version_id
        FROM chapters c
        JOIN works w ON w.id = c.work_id
        LEFT JOIN reading_progress rp ON rp.chapter_id = c.id AND rp.user_id = ?
        WHERE c.id = ? AND c.status != 'hidden' AND w.is_archived = 0
      `).bind(user.id, chapterId).first();
      return chapter ? json({ chapter }) : json({ error: 'Chapter not found' }, 404);
    }

    if (request.method === 'POST' && url.pathname === '/api/reading-progress') {
      if (!sameOrigin(request)) return json({ error: 'Invalid origin' }, 403);
      const body = await request.json().catch(() => null) as null | {
        chapterId?: string;
        progressPercent?: number;
        scrollAnchor?: string;
      };
      if (!body?.chapterId || !Number.isInteger(body.progressPercent) || (body.progressPercent ?? -1) < 0 || (body.progressPercent ?? 101) > 100) {
        return json({ error: 'Invalid reading progress' }, 400);
      }
      if ((body.scrollAnchor?.length ?? 0) > 500) return json({ error: 'Scroll anchor is too large' }, 413);

      const visibleChapter = await env.DB.prepare(`
        SELECT c.id
        FROM chapters c
        JOIN works w ON w.id = c.work_id
        WHERE c.id = ? AND c.status != 'hidden' AND w.is_archived = 0
      `).bind(body.chapterId).first<{ id: string }>();
      if (!visibleChapter) return json({ error: 'Chapter not found' }, 404);

      const progressPercent = body.progressPercent as number;
      const completedAt = progressPercent === 100 ? new Date().toISOString() : null;
      await env.DB.prepare(`
        INSERT INTO reading_progress (user_id, chapter_id, progress_percent, scroll_anchor, completed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, chapter_id) DO UPDATE SET
          progress_percent = excluded.progress_percent,
          scroll_anchor = excluded.scroll_anchor,
          completed_at = CASE
            WHEN excluded.progress_percent = 100 THEN COALESCE(reading_progress.completed_at, excluded.completed_at)
            ELSE NULL
          END,
          updated_at = CURRENT_TIMESTAMP
      `).bind(user.id, body.chapterId, progressPercent, body.scrollAnchor ?? '', completedAt).run();
      return json({ ok: true });
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
      if (!sameOrigin(request)) return json({ error: 'Invalid origin' }, 403);
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
        SELECT cv.normalized_text AS version_text, cv.source_hash AS version_hash,
               c.source_hash AS current_hash, c.work_id
        FROM chapter_versions cv
        JOIN chapters c ON c.id = cv.chapter_id
        WHERE cv.id = ? AND c.id = ?
      `).bind(body.chapterVersionId, body.chapterId).first<{
        version_text: string;
        version_hash: string;
        current_hash: string;
        work_id: string;
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

      await env.DB.prepare(`
        INSERT INTO activity (id, user_id, work_id, chapter_id, suggestion_id, event_type, payload_json)
        VALUES (?, ?, ?, ?, ?, 'suggestion_created', ?)
      `).bind(
        crypto.randomUUID(),
        user.id,
        version.work_id,
        body.chapterId,
        suggestionId,
        JSON.stringify({ category: body.category, status }),
      ).run();

      return json({ id: suggestionId, status }, 201);
    }

    return json({ error: 'Not found' }, 404);
  },
};
