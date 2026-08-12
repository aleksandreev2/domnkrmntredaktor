import { callDriveBridge } from './driveBridge';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

function routeParts(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'domnkrmntredaktor', time: new Date().toISOString() });
    }

    if (url.pathname === '/api/drive/health') {
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
      return json({ ok: false, error: 'Authentication is not configured yet' }, 503);
    }

    return json({ error: 'Not found' }, 404);
  },
};
