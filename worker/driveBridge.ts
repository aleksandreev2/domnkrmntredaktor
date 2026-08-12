function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toBase64Url(new Uint8Array(signature));
}

export async function callDriveBridge<T>(
  env: Env,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!env.DRIVE_BRIDGE_URL || !env.DRIVE_BRIDGE_SECRET) {
    throw new Error('Drive bridge is not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const payloadJson = JSON.stringify(payload);
  const canonical = `${action}\n${timestamp}\n${nonce}\n${payloadJson}`;
  const signature = await hmac(env.DRIVE_BRIDGE_SECRET, canonical);

  const response = await fetch(env.DRIVE_BRIDGE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, timestamp, nonce, payload, signature }),
  });

  const data = await response.json() as { ok: boolean; result?: T; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Drive bridge returned HTTP ${response.status}`);
  }
  return data.result as T;
}
