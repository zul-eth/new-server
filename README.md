---

# 🛡️ Simple Captcha Token Server (Vercel + KV)

Proyek ini adalah server sederhana menggunakan **Vercel Serverless Function** + **Vercel KV (Upstash Redis)**  
untuk menyimpan token Captcha sementara dengan TTL (time-to-live) dan opsi konsumsi sekali pakai.

---

## 🚀 Setup & Deploy

### 1. Buka Codespaces
- Buka repo di GitHub → **Code → Codespaces → Create codespace on main**.
- Tunggu sampai environment terbuka.

### 2. Cek Node.js & npm
```bash
node -v
npm -v

3. Install Dependency

npm init -y
npm i @vercel/node @vercel/kv
npm i -D typescript @types/node vercel
npx tsc --init

4. Konfigurasi

package.json → tambahkan script:

"scripts": {
  "dev": "vercel dev --port 3000",
  "deploy": "vercel --prod"
}

vercel.json

{}

tsconfig.json (pastikan minimal seperti ini):

{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"]
}

5. Buat API Function

api/captcha/index.ts:

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

async function readRawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      const raw = await readRawBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const { token, id, ttl } = body;

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

6. Login & Init Vercel

npx vercel login
npx vercel

7. Tambahkan KV

Buka Vercel Dashboard → Project → Storage → Add → Upstash Redis.

Attach ke Production environment.

Env vars otomatis dibuat:

KV_REST_API_URL

KV_REST_API_TOKEN



8. Tarik Env (opsional untuk lokal dev)

npx vercel env pull .env.local

9. Jalankan Lokal

npm run dev

Buka http://localhost:3000/api/captcha (atau URL Codespaces).


---

🌐 Deploy ke Production

npm run deploy

Hasilnya → https://<project>.vercel.app/api/captcha.


---

🔧 Contoh Penggunaan

Simpan Token

curl -X POST "https://<project>.vercel.app/api/captcha" \
  -H "Content-Type: application/json" \
  -d '{"id":"abc123","token":"HELLO","ttl":120}'

Ambil Token (tanpa hapus)

curl "https://<project>.vercel.app/api/captcha?id=abc123"

Ambil + Hapus Token (sekali pakai)

curl "https://<project>.vercel.app/api/captcha?id=abc123&consume=true"


---

📦 GitHub Push

git add .
git commit -m "init captcha server"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main



✅ Catatan

TTL default 120 detik (max 10 menit).

Token dihapus otomatis setelah TTL habis atau sekali pakai (consume=true).

Free plan Vercel + KV cukup untuk puluhan ribu request/bulan.


---
