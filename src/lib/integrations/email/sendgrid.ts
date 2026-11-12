/** SendGrid's fixed HTTPS endpoint; this check never sends a message. */
const SCOPES_URL = 'https://api.sendgrid.com/v3/scopes';
export type SendGridCheck = { state: 'verified' | 'invalid' | 'unavailable'; mailSendScope: boolean | null };
export async function checkSendGridKey(key: string, options: { fetcher?: typeof fetch; signal?: AbortSignal } = {}): Promise<SendGridCheck> {
  if (!/^SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key) || key.length > 512) return { state: 'invalid', mailSendScope: null };
  try {
    const response = await (options.fetcher ?? fetch)(SCOPES_URL, {
      method: 'GET', headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: options.signal ?? AbortSignal.timeout(8000),
    });
    if (response.status === 401) return { state: 'invalid', mailSendScope: null };
    // A forbidden scopes endpoint does not prove the key itself is invalid.
    if (response.status === 403) return { state: 'unavailable', mailSendScope: null };
    if (!response.ok) return { state: 'unavailable', mailSendScope: null };
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > 65536) return { state: 'unavailable', mailSendScope: null };
    if (!response.body) return { state: 'unavailable', mailSendScope: null };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); return { state: 'unavailable', mailSendScope: null }; }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || !('scopes' in data) || !Array.isArray(data.scopes) || data.scopes.some(s => typeof s !== 'string')) return { state: 'unavailable', mailSendScope: null };
    return { state: 'verified', mailSendScope: data.scopes.includes('mail.send') };
  } catch { return { state: 'unavailable', mailSendScope: null }; }
}
