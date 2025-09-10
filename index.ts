import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS sederhana (ubah origin untuk produksi)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      const { token, id, ttl } = req.body || {};
      if (!token || !id) return res.status(400).json({ error: 'token dan id wajib' });

      const seconds = Number(ttl) > 0 ? Math.min(Number(ttl), 600) : 120; // max 10 menit
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
    console.error(err);
    return res.status(500).json({ error: 'internal error', detail: err?.message });
  }
}
