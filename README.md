# ðŸ›¡ï¸ Simple Captcha Token Server (Vercel + KV)

Server sederhana berbasis **Vercel Serverless Function** + **Vercel KV
(Upstash Redis)** untuk menyimpan token Captcha sementara dengan TTL
(time-to-live) dan opsi konsumsi satu kali (one-time).

------------------------------------------------------------------------

## Daftar Isi

-   [Fitur](#fitur)
-   [Arsitektur Singkat](#arsitektur-singkat)
-   [Prasyarat](#prasyarat)
-   [Setup & Deploy](#-setup--deploy)
    -   [1) Buka Codespaces (opsional)](#1-buka-codespaces-opsional)
    -   [2) Cek Node.js & npm](#2-cek-nodejs--npm)
    -   [3) Instalasi Dependencies](#3-instalasi-dependencies)
    -   [4) Konfigurasi Project](#4-konfigurasi-project)
    -   [5) Buat API Function](#5-buat-api-function)
    -   [6) Login & Init Vercel](#6-login--init-vercel)
    -   [7) Tambahkan Vercel KV](#7-tambahkan-vercel-kv)
    -   [8) Tarik ENV untuk Lokal
        (opsional)](#8-tarik-env-untuk-lokal-opsional)
    -   [9) Jalankan Secara Lokal](#9-jalankan-secara-lokal)
-   [Spesifikasi API](#spesifikasi-api)
    -   [POST `/api/captcha`](#post-apicaptcha)
    -   [GET `/api/captcha`](#get-apicaptcha)
-   [Contoh cURL](#contoh-curl)
-   [CORS](#cors)
-   [Catatan Keamanan & Praktik
    Terbaik](#catatan-keamanan--praktik-terbaik)
-   [Struktur Direktori](#struktur-direktori)
-   [Lisensi](#lisensi)

------------------------------------------------------------------------

## Fitur

-   Simpan token Captcha di **Vercel KV** dengan TTL (default **120
    detik**, maksimum **600 detik**).
-   Ambil token berdasarkan `id`.
-   Opsi **sekali pakai**: hapus token saat diambil (`consume=true`).
-   **CORS** diizinkan untuk semua origin (bisa disesuaikan).

------------------------------------------------------------------------

## Arsitektur Singkat

-   **Client** menghasilkan dan mengirim token + `id` â†’ **Serverless
    Function** menyimpan ke **KV** dengan TTL.
-   **Verifier** (mis. backend Anda) meng-`GET` token berdasarkan `id`
    dan bisa **mengonsumsi** (hapus) token tersebut.

------------------------------------------------------------------------

## Prasyarat

-   Node.js 18+ dan npm
-   Akun Vercel
-   Akses **Vercel KV (Upstash Redis)**

------------------------------------------------------------------------

## ðŸš€ Setup & Deploy

### 1) Buka Codespaces (opsional)

-   Buka repo di GitHub â†’ **Code â†’ Codespaces â†’ Create codespace on
    main**.
-   Tunggu environment siap.

### 2) Cek Node.js & npm

``` bash
node -v
npm -v
```

### 3) Instalasi Dependencies

``` bash
npm init -y
npm i @vercel/node @vercel/kv
npm i -D typescript @types/node vercel
npx tsc --init
```

### 4) Konfigurasi Project

**`package.json`** â†’ tambahkan script:

``` json
{
  "scripts": {
    "dev": "vercel dev --port 3000",
    "deploy": "vercel --prod"
  }
}
```

**`vercel.json`** (minimal):

``` json
{}
```

**`tsconfig.json`** (minimal):

``` json
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
```

### 5) Buat API Function

**`api/captcha/index.ts`**

``` ts
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
```

### 6) Login & Init Vercel

``` bash
npx vercel login
npx vercel
```

### 7) Tambahkan Vercel KV

-   Vercel Dashboard â†’ Project â†’ **Storage** â†’ **Add** â†’ **Upstash
    Redis**.
-   Attach ke **Production**.
-   Env vars akan otomatis dibuat:
    -   `KV_REST_API_URL`
    -   `KV_REST_API_TOKEN`

### 8) Tarik ENV untuk Lokal (opsional)

``` bash
npx vercel env pull .env.local
```

### 9) Jalankan Secara Lokal

``` bash
npm run dev
```

-   Buka `http://localhost:3000/api/captcha` (atau URL Codespaces).

------------------------------------------------------------------------

## Spesifikasi API

### POST `/api/captcha`

Simpan token dengan TTL.

**Body (JSON)**

``` json
{
  "id": "unique-captcha-id",
  "token": "captcha-token-value",
  "ttl": 120
}
```

-   `id` (wajib): identifier unik token.
-   `token` (wajib): nilai token.
-   `ttl` (opsional): detik; default **120**, maksimum **600**.

**Response** - `201 Created`

``` json
{ "ok": true, "ttl": 120 }
```

-   `400 Bad Request` jika field wajib tidak ada.
-   `500 Internal Server Error` jika terjadi kesalahan server.

------------------------------------------------------------------------

### GET `/api/captcha?id=...&consume=...`

Ambil token berdasarkan `id`.

**Query** - `id` (wajib): identifier token. - `consume` (opsional):
`true`/`false`. Jika `true`, token akan dihapus setelah diambil.

**Response** - `200 OK`

``` json
{ "token": "captcha-token-value", "consumed": true }
```

-   `400 Bad Request` jika `id` tidak diberikan.
-   `404 Not Found` jika token tidak ada atau sudah kedaluwarsa.

------------------------------------------------------------------------

## Contoh cURL

**Simpan token**

``` bash
curl -X POST "https://<YOUR-VERCEL-URL>/api/captcha"   -H "Content-Type: application/json"   -d '{"id":"abc123","token":"xyz789","ttl":180}'
```

**Ambil token tanpa konsumsi**

``` bash
curl "https://<YOUR-VERCEL-URL>/api/captcha?id=abc123"
```

**Ambil token dan konsumsi (hapus)**

``` bash
curl "https://<YOUR-VERCEL-URL>/api/captcha?id=abc123&consume=true"
```

------------------------------------------------------------------------

## CORS

Header CORS diaktifkan untuk semua origin (`*`) pada metode `GET`,
`POST`, dan `OPTIONS`. Atur ulang kebijakan ini sesuai kebutuhan
produksi Anda.

------------------------------------------------------------------------

## Catatan Keamanan & Praktik Terbaik

-   Gunakan `consume=true` saat verifikasi agar token **sekali pakai**.
-   Batasi TTL seperlunya; default 120 detik, maksimum 600 detik.
-   Validasi `id`/`token` di sisi Anda sesuai kebutuhan keamanan.
-   Untuk produksi, pertimbangkan pembatasan origin (CORS) dan
    rate-limiting.

------------------------------------------------------------------------

## Struktur Direktori

    .
    â”œâ”€â”€ api/
    â”‚   â””â”€â”€ captcha/
    â”‚       â””â”€â”€ index.ts
    â”œâ”€â”€ package.json
    â”œâ”€â”€ tsconfig.json
    â””â”€â”€ vercel.json

------------------------------------------------------------------------

## Lisensi

Bebas digunakan untuk kebutuhan Anda. Tambahkan file `LICENSE` jika
memerlukan ketentuan spesifik (mis. MIT).
