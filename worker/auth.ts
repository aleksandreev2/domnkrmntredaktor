import { createRemoteJWKSet, jwtVerify } from 'jose';

const TELEGRAM_ISSUER = 'https://oauth.telegram.org';
const TELEGRAM_AUTH_URL = 'https://oauth.telegram.org/auth';
const TELEGRAM_TOKEN_URL = 'https://oauth.telegram.org/token';
const TELEGRAM_JWKS = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'));
const SESSION_COOKIE = 'domnkr_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const OIDC_TTL_SECONDS = 10 * 60;

export type AuthUser = {
  id: string;
  telegramId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: 'reader' | 'editor' | 'admin';
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function appOrigin(request: Request): string {
  return new URL(request.url).origin;
}

function callbackUrl(request: Request): string {
  return `${appOrigin(request)}/api/auth/callback`;
}

function getCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sessionCookie(request: Request, token: string, maxAge = SESSION_TTL_SECONDS): string {
  const secure = appOrigin(request).startsWith('https://') ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearSessionCookie(request: Request): string {
  return sessionCookie(request, '', 0);
}

function requireTelegramConfig(env: Env): { clientId: string; clientSecret: string } {
  const clientId = env.TELEGRAM_CLIENT_ID;
  const clientSecret = env.TELEGRAM_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Telegram OIDC is not configured');
  return { clientId, clientSecret };
}

export function isTelegramConfigured(env: Env): boolean {
  return Boolean(env.TELEGRAM_CLIENT_ID && env.TELEGRAM_CLIENT_SECRET);
}

export async function beginTelegramLogin(request: Request, env: Env): Promise<Response> {
  const { clientId } = requireTelegramConfig(env);
  const state = randomToken(32);
  const codeVerifier = randomToken(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const expiresAt = new Date(Date.now() + OIDC_TTL_SECONDS * 1000).toISOString();

  await env.DB.prepare('DELETE FROM oidc_requests WHERE datetime(expires_at) <= datetime(?)')
    .bind(new Date().toISOString()).run();
  await env.DB.prepare('INSERT INTO oidc_requests (state, code_verifier, expires_at) VALUES (?, ?, ?)')
    .bind(state, codeVerifier, expiresAt).run();

  const url = new URL(TELEGRAM_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl(request));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return Response.redirect(url.toString(), 302);
}

export async function finishTelegramLogin(request: Request, env: Env): Promise<Response> {
  const { clientId, clientSecret } = requireTelegramConfig(env);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return Response.redirect(`${appOrigin(request)}/?auth=error`, 302);
  if (!code || !state) return new Response('Invalid Telegram callback', { status: 400 });

  const pending = await env.DB.prepare(
    'SELECT code_verifier, expires_at FROM oidc_requests WHERE state = ?',
  ).bind(state).first<{ code_verifier: string; expires_at: string }>();

  if (!pending || Date.parse(pending.expires_at) <= Date.now()) {
    if (pending) await env.DB.prepare('DELETE FROM oidc_requests WHERE state = ?').bind(state).run();
    return new Response('Login request expired. Try again.', { status: 400 });
  }

  await env.DB.prepare('DELETE FROM oidc_requests WHERE state = ?').bind(state).run();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(request),
    client_id: clientId,
    code_verifier: pending.code_verifier,
  });

  const tokenResponse = await fetch(TELEGRAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body,
  });

  if (!tokenResponse.ok) return new Response('Telegram token exchange failed', { status: 502 });
  const tokens = await tokenResponse.json() as { id_token?: string };
  if (!tokens.id_token) return new Response('Telegram did not return an ID token', { status: 502 });

  const verified = await jwtVerify(tokens.id_token, TELEGRAM_JWKS, {
    issuer: TELEGRAM_ISSUER,
    audience: clientId,
  });
  const claims = verified.payload as Record<string, unknown>;
  const telegramId = String(claims.id ?? claims.sub ?? '');
  if (!telegramId) return new Response('Telegram ID is missing', { status: 502 });

  let access = await env.DB.prepare(
    'SELECT role FROM access_list WHERE telegram_id = ? AND is_enabled = 1',
  ).bind(telegramId).first<{ role: 'reader' | 'editor' | 'admin' }>();

  if (!access && env.BOOTSTRAP_ADMIN_TELEGRAM_ID && telegramId === env.BOOTSTRAP_ADMIN_TELEGRAM_ID.trim()) {
    await env.DB.prepare(`
      INSERT INTO access_list (telegram_id, role, note, is_enabled, updated_at)
      VALUES (?, 'admin', 'Initial bootstrap administrator', 1, CURRENT_TIMESTAMP)
      ON CONFLICT(telegram_id) DO UPDATE SET
        role = 'admin',
        is_enabled = 1,
        note = 'Initial bootstrap administrator',
        updated_at = CURRENT_TIMESTAMP
    `).bind(telegramId).run();
    access = { role: 'admin' };
  }

  if (!access) {
    const denied = new URL(appOrigin(request));
    denied.searchParams.set('auth', 'denied');
    denied.searchParams.set('telegram_id', telegramId);
    return Response.redirect(denied.toString(), 302);
  }

  const username = typeof claims.preferred_username === 'string' ? claims.preferred_username : null;
  const displayName = typeof claims.name === 'string'
    ? claims.name
    : username
      ? `@${username}`
      : `Telegram ${telegramId}`;
  const avatarUrl = typeof claims.picture === 'string' ? claims.picture : null;
  const existing = await env.DB.prepare('SELECT id FROM users WHERE telegram_id = ?')
    .bind(telegramId).first<{ id: string }>();
  const userId = existing?.id ?? crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO users (id, telegram_id, telegram_username, display_name, avatar_url, role, is_blocked, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(telegram_id) DO UPDATE SET
      telegram_username = excluded.telegram_username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      role = excluded.role,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, telegramId, username, displayName, avatarUrl, access.role).run();

  const rawSessionToken = randomToken(48);
  const tokenHash = await sha256Base64Url(rawSessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare('DELETE FROM sessions WHERE datetime(expires_at) <= datetime(?)')
    .bind(new Date().toISOString()).run();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, expiresAt).run();

  return new Response(null, {
    status: 302,
    headers: {
      location: appOrigin(request),
      'set-cookie': sessionCookie(request, rawSessionToken),
      'cache-control': 'no-store',
    },
  });
}

export async function getSessionUser(request: Request, env: Env): Promise<AuthUser | null> {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = await sha256Base64Url(rawToken);
  const row = await env.DB.prepare(`
    SELECT u.id, u.telegram_id, u.telegram_username, u.display_name, u.avatar_url, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND datetime(s.expires_at) > datetime(?)
      AND u.is_blocked = 0
  `).bind(tokenHash, new Date().toISOString()).first<{
    id: string;
    telegram_id: string;
    telegram_username: string | null;
    display_name: string;
    avatar_url: string | null;
    role: 'reader' | 'editor' | 'admin';
  }>();
  if (!row) return null;

  await env.DB.prepare('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?')
    .bind(tokenHash).run();

  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.telegram_username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
  };
}

export async function logout(request: Request, env: Env): Promise<Response> {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (rawToken) {
    const tokenHash = await sha256Base64Url(rawToken);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': clearSessionCookie(request), 'cache-control': 'no-store' },
  });
}
