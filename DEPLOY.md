# Deploy ke VPS (aaPanel)

Dua domain, satu repo:

| Domain | Isi | Root di aaPanel |
|---|---|---|
| **https://selfstudio.studiopoonya.net** | Website (React, hasil build) | `/www/wwwroot/selfstudio/frontend/dist` |
| **https://api.selfstudio.studiopoonya.net** | API Laravel, webhook, foto studio | `/www/wwwroot/selfstudio/backend/public` |

Folder kode di server: `/www/wwwroot/selfstudio` (isi repo: `backend/` + `frontend/`).
PHP: **8.2** (CLI: `/www/server/php/82/bin/php`).

> **Server ini memakai OpenLiteSpeed, bukan Nginx.** Port 80/443 dilayani LiteSpeed
> (`/usr/local/lsws`). Pengaturan situs lewat aaPanel (Directory, SSL, URL rewrite) masuk ke
> config Nginx yang tidak dipakai, dan simpanannya gagal karena `nginx -t` error di situs lain.
> Jadi **jangan ubah situs selfstudio lewat aaPanel**. Yang sudah dipasang (21 Okt 2026):
>
> - `httpd_config.conf`: `map` kedua domain di bawah `map new-apps...` (listener 80 dan 443) +
>   `include .../openlitespeed/{selfstudio,api.selfstudio}.studiopoonya.net.conf`
>   (backup: `httpd_config.conf.bak-sebelum-selfstudio`, skrip: `/root/fix-selfstudio-ols.sh`).
> - Vhost API: `vhRoot /www/wwwroot/selfstudio/backend`, `docRoot $VH_ROOT/public/`.
>   Website: `vhRoot /www/wwwroot/selfstudio/frontend/dist`.
> - Rewrite lewat `.htaccess` (`autoLoadHtaccess 1`): `backend/public/.htaccess` (Laravel) dan
>   `frontend/public/.htaccess` (SPA, ikut ter-copy ke `dist` saat build). Keduanya memaksa HTTPS.
> - SSL: API = Let's Encrypt (DNS TXT manual, habis 19 Jan 2027). Website = wildcard
>   `*.studiopoonya.net` (habis 18 Nov 2026), harus diperbarui sebelum tanggal itu.
> - Setelah mengubah `.htaccess` atau config LiteSpeed: `/usr/local/lsws/bin/lswsctrl restart` (graceful).
> - Bagian 5 (Nginx) di bawah **tidak berlaku** untuk server ini.

---

## 0. Persiapan (sekali saja)

1. **DNS**: buat A record `selfstudio` dan `api.selfstudio`, keduanya ke IP VPS.
2. PHP 8.2 harus punya ekstensi `fileinfo`, `pdo_mysql`, `mbstring`, `dom`, `gd`, `zip`, `intl`. Semuanya sudah terpasang.
3. **Node.js 20** untuk build frontend (`node -v`).

## 1. Ambil kode

Pakai deploy key dengan alias `github-selfstudio` di `~/.ssh/config`:

```bash
cd /www/wwwroot
git clone -b improvements git@github-selfstudio:studiopoonya/Poonya_Universe.git selfstudio
```

## 2. Database

aaPanel → **Databases**: database `selfstudio`, user `selfstudio`. Password-nya ada di ikon mata.

## 3. Backend (Laravel)

```bash
cd /www/wwwroot/selfstudio/backend
COMPOSER_ALLOW_SUPERUSER=1 /www/server/php/82/bin/php $(which composer) install --no-dev --optimize-autoloader
cp -n .env.example .env
/www/server/php/82/bin/php artisan key:generate
```

Edit `backend/.env` lewat File Manager. Nilai rahasia jangan dikirim ke chat.

```env
APP_NAME="Poonya Studio"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.selfstudio.studiopoonya.net        # domain API
FRONTEND_URL=https://selfstudio.studiopoonya.net       # domain website (CORS + link di email)

DB_DATABASE=selfstudio
DB_USERNAME=selfstudio
DB_PASSWORD=...

QUEUE_CONNECTION=database

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=studiopoonya@gmail.com
MAIL_PASSWORD=...          # App Password Google 16 huruf
MAIL_FROM_ADDRESS="studiopoonya@gmail.com"

MIDTRANS_SERVER_KEY=...    # sama dengan backend/.env di laptop
MIDTRANS_CLIENT_KEY=...
MIDTRANS_IS_PRODUCTION=true

ADMIN_EMAIL=studiopoonya@gmail.com
ADMIN_PASSWORD=...
```

Lalu:

```bash
P=/www/server/php/82/bin/php
$P artisan migrate --force
$P artisan db:seed --force      # admin + studio + jam operasional (sekali saja)
$P artisan storage:link
$P artisan config:cache && $P artisan route:cache && $P artisan view:cache
chown -R www:www /www/wwwroot/selfstudio
chmod -R 775 storage bootstrap/cache
```

## 4. Frontend (build)

```bash
cd /www/wwwroot/selfstudio/frontend
cat > .env.production <<'EOF'
VITE_API_URL=https://api.selfstudio.studiopoonya.net
VITE_SITE_URL=https://selfstudio.studiopoonya.net
EOF
npm ci
npm run build             # hasilnya ada di frontend/dist
```

## 5. Dua situs di aaPanel

### a. Website: `selfstudio.studiopoonya.net`

1. Site → **Conf → Site directory**: ubah root ke `/www/wwwroot/selfstudio/frontend/dist`, lalu Save.
2. **SSL → Let's Encrypt**, lalu aktifkan **Force HTTPS**.
3. **Config file**: di dalam `server { ... }`, tambahkan blok ini tepat di atas baris `include enable-php-82.conf;`:

```nginx
    # ── React SPA: every page falls back to index.html ──
    index index.html;
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
```

### b. API: `api.selfstudio.studiopoonya.net`

1. **Add site**: domain `api.selfstudio.studiopoonya.net`, PHP **8.2**, tanpa database.
   Root: `/www/wwwroot/selfstudio/backend/public`.
2. Site → **Conf → Site directory**: matikan **Anti-XSS attack (open_basedir)**. Laravel perlu membaca folder di atas `public/`.
3. Site → **Conf → URL rewrite**: pilih template **laravel5**, lalu Save. Isinya: `location / { try_files $uri $uri/ /index.php?$query_string; }`
4. **SSL → Let's Encrypt**, lalu aktifkan **Force HTTPS**.
5. **Config file**: tambahkan `client_max_body_size 10m;` di dalam `server { ... }` (untuk upload foto studio).

## 6. Queue worker (wajib, untuk email)

aaPanel → App Store → **Supervisor Manager → Add daemon**:

- Name: `selfstudio-worker`
- Run user: `www`
- Run dir: `/www/wwwroot/selfstudio/backend`
- Start command: `/www/server/php/82/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600`
- Processes: `1`

## 7. Scheduler (wajib, untuk pengingat H-1, booking kedaluwarsa, dan slot harian)

aaPanel → **Cron → Add task**:

- Type: **Shell Script**, Period: **N Minutes = 1**, User: `www`
- Script: `cd /www/wwwroot/selfstudio/backend && /www/server/php/82/bin/php artisan schedule:run >> /dev/null 2>&1`

## 8. Cek

1. https://api.selfstudio.studiopoonya.net/api/settings harus menampilkan JSON (`{"payment_gateway":...}`).
2. https://selfstudio.studiopoonya.net: halaman booking harus muncul dan studio terlihat.
3. https://selfstudio.studiopoonya.net/admin/login: login dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
4. **Admin → Email**: status harus "Aktif dari .env server", lalu klik **Kirim Tes**.
5. **Admin → Settings → Tes Pembayaran**: buat QR Rp100, scan, dan status harus berubah jadi berhasil.

**Webhook Midtrans:** pengaturan **Notification URL** di dashboard Midtrans **tidak perlu diubah**, karena akun itu dipakai juga oleh sistem lain. Setiap transaksi dari aplikasi ini otomatis meminta Midtrans mengirim notifikasi juga ke `https://api.selfstudio.studiopoonya.net/api/webhooks/payment/midtrans`. URL itu diambil dari `APP_URL`.

---

## Update berikutnya

```bash
cd /www/wwwroot/selfstudio && git pull
cd backend
P=/www/server/php/82/bin/php
COMPOSER_ALLOW_SUPERUSER=1 $P $(which composer) install --no-dev --optimize-autoloader
$P artisan migrate --force
$P artisan config:cache && $P artisan route:cache && $P artisan view:cache
$P artisan queue:restart
cd ../frontend && npm ci && npm run build
chown -R www:www /www/wwwroot/selfstudio
/usr/local/lsws/bin/lswsctrl restart     # LiteSpeed: reload .htaccess
```

Kalau git menolak dengan pesan *dubious ownership* (repo dimiliki `www`), jalankan sekali:
`git config --global --add safe.directory /www/wwwroot/selfstudio`

## Kalau ada masalah

- **Website putih atau 404 saat refresh halaman**: blok `location /` dengan `try_files ... /index.html` belum masuk di situs website.
- **Website muncul tapi data tidak keluar (CORS error di console)**: `FRONTEND_URL` di `backend/.env` harus persis `https://selfstudio.studiopoonya.net`, tanpa `/` di akhir. Setelah itu jalankan `config:cache`. Cek juga `VITE_API_URL` di `frontend/.env.production`, lalu build ulang.
- **API 404 untuk semua alamat**: URL rewrite **laravel5** belum dipasang di situs API.
- **API 500**: lihat `backend/storage/logs/laravel.log`. Biasanya karena izin folder (`chown`/`chmod`) atau `.env` yang salah. Setelah mengubah `.env`, selalu jalankan `config:cache`.
- **Email tidak terkirim**: worker di Supervisor belum running, atau App Password salah.
- **Foto studio tidak muncul**: `storage:link` belum dijalankan, atau `APP_URL` salah. Foto disajikan dari domain API.
