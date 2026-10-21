# Deploy ke VPS (aaPanel)

Domain: **https://selfstudio.studiopoonya.net**. Frontend dan API ada di satu domain:

- `/` adalah React (hasil build `frontend/dist`)
- `/api/...` adalah Laravel (`backend/public/index.php`)
- `/storage/...` adalah foto studio yang di-upload

Karena satu domain, CORS tidak perlu diatur dan cukup satu sertifikat SSL.

Folder di server: `/www/wwwroot/selfstudio` (isi repo: `backend/` + `frontend/`).
PHP: **8.2** (CLI: `/www/server/php/82/bin/php`). Kalau pakai 8.3, ganti `82` jadi `83` di semua perintah.

---

## 0. Persiapan (sekali saja)

1. **DNS**: buat A record `selfstudio` ke IP VPS.
2. **aaPanel → App Store**: pastikan **PHP 8.2**, **MySQL/MariaDB**, dan **Supervisor Manager** terpasang. Pasang juga **Node.js** (Website → Node Project → Node version manager, versi 20).
3. **App Store → PHP 8.2 → Settings**:
   - **Install extensions**: `fileinfo` (wajib untuk upload foto). `opcache` disarankan.
   - **Disabled functions**: hapus `putenv`, `proc_open`, `proc_get_status`, `symlink` dari daftar. Composer dan scheduler Laravel membutuhkannya.
4. **Composer**: `composer --version`. Kalau belum ada:
   `curl -sS https://getcomposer.org/installer | /www/server/php/82/bin/php -- --install-dir=/usr/local/bin --filename=composer`

## 1. Ambil kode

Repo-nya private. Buat **deploy key**:

```bash
ssh-keygen -t ed25519 -C "vps-selfstudio" -f ~/.ssh/selfstudio -N ""
cat ~/.ssh/selfstudio.pub   # tempel di GitHub → repo → Settings → Deploy keys (read-only)
cat >> ~/.ssh/config <<'EOF'
Host github-selfstudio
  HostName github.com
  IdentityFile ~/.ssh/selfstudio
EOF

cd /www/wwwroot
git clone -b improvements git@github-selfstudio:studiopoonya/Poonya_Universe.git selfstudio
```

## 2. Database

aaPanel → **Databases** → Add database: nama `selfstudio`, user `selfstudio`, password kuat. Simpan password-nya.

## 3. Backend (Laravel)

```bash
cd /www/wwwroot/selfstudio/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
/www/server/php/82/bin/php artisan key:generate
```

Edit `backend/.env` (lewat File Manager). Nilai rahasia jangan dikirim ke chat.

```env
APP_NAME="Poonya Studio"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://selfstudio.studiopoonya.net
FRONTEND_URL=https://selfstudio.studiopoonya.net

DB_DATABASE=selfstudio
DB_USERNAME=selfstudio
DB_PASSWORD=...            # dari langkah 2

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
ADMIN_PASSWORD=...         # password login admin
```

Lalu:

```bash
/www/server/php/82/bin/php artisan migrate --force
/www/server/php/82/bin/php artisan db:seed --force      # admin + studio + jam operasional (sekali saja)
/www/server/php/82/bin/php artisan storage:link
/www/server/php/82/bin/php artisan config:cache
/www/server/php/82/bin/php artisan route:cache
/www/server/php/82/bin/php artisan view:cache
chown -R www:www /www/wwwroot/selfstudio
chmod -R 775 storage bootstrap/cache
```

## 4. Frontend (build)

```bash
cd /www/wwwroot/selfstudio/frontend
echo "VITE_SITE_URL=https://selfstudio.studiopoonya.net" > .env.production
npm ci
npm run build             # hasilnya ada di frontend/dist
```

## 5. Website + Nginx

1. aaPanel → **Website → Add site**: domain `selfstudio.studiopoonya.net`, PHP **8.2**, tanpa database.
   **Root directory**: `/www/wwwroot/selfstudio/frontend/dist`.
2. Site → **Conf → Site directory**: matikan **Anti-XSS attack (open_basedir)**. Laravel ada di luar folder `dist`.
3. Site → **Conf → SSL → Let's Encrypt**, lalu aktifkan **Force HTTPS**.
4. Site → **Conf → Config file**. Di dalam blok `server { ... }`, cari baris `include enable-php-82.conf;` dan tambahkan blok berikut **tepat di atasnya**:

```nginx
    # ── Poonya Studio: React SPA + Laravel API on one domain ──
    index index.html;

    location ^~ /api {
        root /www/wwwroot/selfstudio/backend/public;
        try_files $uri /index.php?$query_string;
    }

    location = /index.php {
        root /www/wwwroot/selfstudio/backend/public;
        fastcgi_pass unix:/tmp/php-cgi-82.sock;
        fastcgi_param SCRIPT_FILENAME $document_root/index.php;
        include fastcgi_params;
        fastcgi_read_timeout 60s;
    }

    location ^~ /storage/ {
        alias /www/wwwroot/selfstudio/backend/storage/app/public/;
        expires 30d;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    client_max_body_size 10m;
```

Simpan. aaPanel akan mengecek config-nya. Kalau ada error, biasanya karena di file itu sudah ada blok `location /` lain. Hapus blok yang lama.

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

1. Buka https://selfstudio.studiopoonya.net. Halaman booking harus muncul.
2. https://selfstudio.studiopoonya.net/admin/login. Login dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
3. **Admin → Email**: status harus "Aktif dari .env server", lalu klik **Kirim Tes**.
4. **Admin → Settings → Tes Pembayaran**: buat QR Rp100, scan, dan status harus berubah jadi berhasil.

**Webhook Midtrans:** pengaturan **Notification URL** di dashboard Midtrans **tidak perlu diubah**, karena akun itu dipakai juga oleh sistem lain. Setiap transaksi dari aplikasi ini otomatis meminta Midtrans mengirim notifikasi juga ke `https://selfstudio.studiopoonya.net/api/webhooks/payment/midtrans` (header `X-Append-Notification`).

---

## Update berikutnya

```bash
cd /www/wwwroot/selfstudio && git pull
cd backend
composer install --no-dev --optimize-autoloader
/www/server/php/82/bin/php artisan migrate --force
/www/server/php/82/bin/php artisan config:cache && /www/server/php/82/bin/php artisan route:cache && /www/server/php/82/bin/php artisan view:cache
/www/server/php/82/bin/php artisan queue:restart
cd ../frontend && npm ci && npm run build
chown -R www:www /www/wwwroot/selfstudio
```

## Kalau ada masalah

- **Halaman putih atau 404 saat refresh**: blok `location /` dengan `try_files ... /index.html` belum masuk.
- **API 500**: lihat `backend/storage/logs/laravel.log`. Biasanya karena izin folder (`chown`/`chmod` di langkah 3) atau `.env` yang salah. Setelah mengubah `.env`, selalu jalankan `config:cache`.
- **Email tidak terkirim**: worker di Supervisor belum running, atau App Password salah. Cek `storage/logs/laravel.log`.
- **Foto studio tidak muncul**: blok `/storage/` belum ada, atau `fileinfo` belum terpasang.
