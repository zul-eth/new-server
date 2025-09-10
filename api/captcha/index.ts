// api/captcha/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

async function readRawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');

  // Fallback: stream body
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (optional)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      const raw = await readRawBody(req);
      let body: any = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }

      const { token, id, ttl } = body || {};
      if (!token || !id) {
        return res.status(400).json({ error: 'token dan id wajib', received: body });
      }

      const seconds = Number(ttl) > 0 ? Math.min(Number(ttl), 600) : 120;
      await kv.set(`captcha:${id}`, token, { ex: seconds });
      return res.status(201).json({ ok: true, ttl: seconds });
    }

    if (req.method === 'GET') {
      const { id, consume } = req.query as { id?: string; consume?: string };
      if (!id) return res.status(400).json({ error: 'id wajib' });

      const key = `captcha:${id}`;
      const token = await kv.get<string>(key);
      if (!token) return res.status(404).json({ error: 'token tidak ditemukan / kedaluwarsa' });

      if (consume === 'true') await kv.del(key);
      return res.status(200).json({ token, consumed: consume === 'true' });
    }

    res.setHeader('Allow', 'POST, GET, OPTIONS');
    return res.status(405).end('Method Not Allowed');
  } catch (err: any) {
    console.error('captcha api error:', err);
    return res.status(500).json({ error: 'internal error', detail: err?.message });
  }
}
