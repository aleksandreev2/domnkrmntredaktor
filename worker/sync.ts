import { callDriveBridge } from './driveBridge';

type DriveWork = { id: string; name: string };
type DriveChapterMeta = { id: string; name: string; mimeType: string; modifiedAt: string; size: number };
type DriveChapter = { id: string; name: string; format: 'txt' | 'docx'; modifiedAt: string; text: string };

type SyncStats = {
  works: number;
  chaptersSeen: number;
  chaptersCreated: number;
  chaptersUpdated: number;
  chaptersUnchanged: number;
  chaptersHidden: number;
  skipped: Array<{ fileId: string; fileName: string; reason: string }>;
};

function sha256Hex(value: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then((buffer) =>
    Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  );
}

function parseChapterNumber(fileName: string): number | null {
  const stem = fileName.replace(/\.(txt|docx)$/i, '');
  const explicit = stem.match(/(?:глава|chapter|ch\.?)[\s_#-]*(\d+(?:[.,]\d+)?)/i);
  const generic = stem.match(/\d+(?:[.,]\d+)?/);
  const raw = explicit?.[1] ?? generic?.[0];
  if (!raw) return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function chapterTitle(fileName: string, chapterNumber: number): string {
  const stem = fileName.replace(/\.(txt|docx)$/i, '').trim();
  const withoutPrefix = stem
    .replace(new RegExp(`^(?:глава|chapter|ch\\.?)?\\s*[#№]?\\s*${String(chapterNumber).replace('.', '[.,]')}\\s*[-—–.:_]*\\s*`, 'i'), '')
    .trim();
  return withoutPrefix ? `Глава ${chapterNumber}. ${withoutPrefix}` : `Глава ${chapterNumber}`;
}

function workId(folderId: string): string {
  return `drive-work:${folderId}`;
}

function stableWorkSlug(folderId: string): string {
  return `drive-${folderId.slice(-20).replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

async function markMissingChaptersHidden(env: Env, currentWorkId: string, seenFileIds: string[]): Promise<number> {
  if (seenFileIds.length === 0) {
    const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM chapters WHERE work_id = ? AND status != 'hidden'")
      .bind(currentWorkId).first<{ count: number }>();
    await env.DB.prepare("UPDATE chapters SET status = 'hidden', updated_at = CURRENT_TIMESTAMP WHERE work_id = ? AND status != 'hidden'")
      .bind(currentWorkId).run();
    return Number(existing?.count ?? 0);
  }

  const placeholders = seenFileIds.map(() => '?').join(', ');
  const values = [currentWorkId, ...seenFileIds];
  const existing = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM chapters WHERE work_id = ? AND status != 'hidden' AND source_file_id NOT IN (${placeholders})`,
  ).bind(...values).first<{ count: number }>();
  await env.DB.prepare(
    `UPDATE chapters SET status = 'hidden', updated_at = CURRENT_TIMESTAMP WHERE work_id = ? AND status != 'hidden' AND source_file_id NOT IN (${placeholders})`,
  ).bind(...values).run();
  return Number(existing?.count ?? 0);
}

export async function syncDrive(env: Env): Promise<SyncStats> {
  const works = await callDriveBridge<DriveWork[]>(env, 'listWorks');
  const stats: SyncStats = {
    works: works.length,
    chaptersSeen: 0,
    chaptersCreated: 0,
    chaptersUpdated: 0,
    chaptersUnchanged: 0,
    chaptersHidden: 0,
    skipped: [],
  };

  // Everything in `works` is Drive-managed, so archive first and unarchive what is still present.
  await env.DB.prepare('UPDATE works SET is_archived = 1, updated_at = CURRENT_TIMESTAMP').run();

  for (const driveWork of works) {
    const currentWorkId = workId(driveWork.id);
    await env.DB.prepare(`
      INSERT INTO works (id, slug, title, source_folder_id, is_archived, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(source_folder_id) DO UPDATE SET
        title = excluded.title,
        is_archived = 0,
        updated_at = CURRENT_TIMESTAMP
    `).bind(currentWorkId, stableWorkSlug(driveWork.id), driveWork.name, driveWork.id).run();

    const chapterFiles = await callDriveBridge<DriveChapterMeta[]>(env, 'listChapters', { workFolderId: driveWork.id });
    const seenFileIds: string[] = [];

    for (const meta of chapterFiles) {
      stats.chaptersSeen += 1;
      seenFileIds.push(meta.id);
      const chapterNumber = parseChapterNumber(meta.name);
      if (chapterNumber === null) {
        stats.skipped.push({ fileId: meta.id, fileName: meta.name, reason: 'Не удалось определить номер главы из имени файла' });
        continue;
      }

      let existing = await env.DB.prepare(
        'SELECT id, source_file_id, source_hash, source_modified_at FROM chapters WHERE source_file_id = ?',
      ).bind(meta.id).first<{ id: string; source_file_id: string; source_hash: string; source_modified_at: string }>();

      if (!existing) {
        existing = await env.DB.prepare(
          'SELECT id, source_file_id, source_hash, source_modified_at FROM chapters WHERE work_id = ? AND chapter_number = ?',
        ).bind(currentWorkId, chapterNumber).first<{ id: string; source_file_id: string; source_hash: string; source_modified_at: string }>();
      }

      if (existing?.source_file_id === meta.id && existing.source_modified_at === meta.modifiedAt) {
        await env.DB.prepare(`
          UPDATE chapters
          SET title = ?, status = CASE WHEN status = 'hidden' THEN 'editing' ELSE status END, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(chapterTitle(meta.name, chapterNumber), existing.id).run();
        stats.chaptersUnchanged += 1;
        continue;
      }

      const chapter = await callDriveBridge<DriveChapter>(env, 'getChapter', { fileId: meta.id });
      const hash = await sha256Hex(chapter.text);
      const chapterId = existing?.id ?? crypto.randomUUID();
      const isNew = !existing;

      if (isNew) {
        await env.DB.prepare(`
          INSERT INTO chapters (
            id, work_id, chapter_number, title, source_file_id, source_format,
            source_hash, source_modified_at, normalized_text, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'editing')
        `).bind(
          chapterId,
          currentWorkId,
          chapterNumber,
          chapterTitle(meta.name, chapterNumber),
          meta.id,
          chapter.format,
          hash,
          chapter.modifiedAt,
          chapter.text,
        ).run();
        stats.chaptersCreated += 1;
      } else {
        await env.DB.prepare(`
          UPDATE chapters SET
            work_id = ?, chapter_number = ?, title = ?, source_file_id = ?, source_format = ?,
            source_hash = ?, source_modified_at = ?, normalized_text = ?,
            status = CASE WHEN status = 'hidden' THEN 'editing' ELSE status END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          currentWorkId,
          chapterNumber,
          chapterTitle(meta.name, chapterNumber),
          meta.id,
          chapter.format,
          hash,
          chapter.modifiedAt,
          chapter.text,
          chapterId,
        ).run();
        stats.chaptersUpdated += 1;
      }

      await env.DB.prepare(`
        INSERT OR IGNORE INTO chapter_versions (
          id, chapter_id, source_hash, source_modified_at, normalized_text
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), chapterId, hash, chapter.modifiedAt, chapter.text).run();
    }

    stats.chaptersHidden += await markMissingChaptersHidden(env, currentWorkId, seenFileIds);
  }

  await env.DB.prepare(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('drive_last_sync', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).bind(JSON.stringify({ at: new Date().toISOString(), ...stats })).run();

  return stats;
}
