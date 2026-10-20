# Poonya Studio — Sistem Booking Self Photo Studio

Customer memilih studio dan jadwal, membayar online lewat Midtrans, lalu menerima email konfirmasi. Admin mengelola booking, walk-in, jadwal, promo, dan laporan dari panel admin.

| Bagian    | Teknologi                                                  | Folder      |
|-----------|------------------------------------------------------------|-------------|
| Frontend  | React 18 + TypeScript + Vite + Tailwind                    | `frontend/` |
| Backend   | Laravel 12 (PHP 8.2+) + Sanctum                            | `backend/`  |
| Database  | MySQL 8 / MariaDB 10.6+ (wajib MySQL, bukan SQLite)        |             |
| Pembayaran| Midtrans Snap (QRIS, e-wallet, VA, kartu)                  |             |

---

## Menjalankan di komputer lokal

**Butuh:** PHP 8.2+, Composer, Node 20+, MySQL (XAMPP juga bisa).

```bash
# Backend
cd backend
cp .env.example .env          # isi DB_*, lalu MIDTRANS_SERVER_KEY (lihat bagian Midtrans)
composer install
php artisan key:generate
php artisan migrate --seed    # tabel + jam operasional + studio contoh + akun admin
php artisan storage:link      # agar foto studio bisa tampil
php artisan serve             # http://localhost:8000

# Frontend (terminal lain)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173 (meneruskan /api dan /storage ke :8000)
```

Login admin di `http://localhost:5173/admin/login` dengan akun dari seeder: `admin@selfstudio.id` / `admin123`. **Segera ganti password-nya** di menu Accounts, lalu aktifkan verifikasi 2 langkah di menu **Keamanan Akun**.

Slot booking dibuat otomatis dari jam operasional, jadi tidak perlu dibuat manual.

### Menjalankan tes

```bash
# sekali saja: buat database khusus tes (isinya dihapus setiap kali tes jalan)
mysql -u root -e "CREATE DATABASE selfstudio_test"

cd backend
php artisan test
```

---

## Deploy ke server

Rekomendasi: frontend dan backend di **satu domain**. Contohnya `https://poonya.studio` untuk situs, dengan API di `https://poonya.studio/api`.

### 1. Siapkan kode

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env && nano .env      # lihat "Isi .env produksi" di bawah
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force            # hanya saat instalasi pertama
php artisan storage:link
php artisan config:cache && php artisan route:cache

cd ../frontend
cp .env.example .env                   # VITE_SITE_URL=https://poonya.studio
npm ci && npm run build                # hasilnya di frontend/dist
```

### 2. Isi `.env` produksi (backend)

| Variabel | Isi |
|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / **`false`** (kalau `true`, detail error terlihat oleh pengunjung) |
| `APP_URL` | `https://poonya.studio` |
| `FRONTEND_URL` | `https://poonya.studio`: tujuan setelah bayar di Midtrans dan link di email |
| `DB_*` | Akses database MySQL |
| `MIDTRANS_SERVER_KEY` | Server key dari dashboard Midtrans (rahasia, **hanya** disimpan di sini) |
| `TRUSTED_PROXIES` | Diisi kalau server berada di belakang Nginx proxy atau Cloudflare (`*` atau IP proxy-nya). Kosongkan kalau server melayani langsung. |
| `QUEUE_CONNECTION` | `database` (default) |
| `SANCTUM_EXPIRATION` | Lama login admin dalam menit. Default 7 hari. |

Email pengirim (SMTP) dan client key Midtrans diatur dari panel admin, tidak lewat `.env`.

### 3. Web server (contoh Nginx)

```nginx
server {
    server_name poonya.studio;
    root /var/www/poonya/frontend/dist;
    index index.html;

    # API & file upload → Laravel
    location ~ ^/(api|storage)/ {
        root /var/www/poonya/backend/public;
        try_files $uri /index.php?$query_string;
    }
    location = /index.php {
        root /var/www/poonya/backend/public;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root/index.php;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    # React router
    location / {
        try_files $uri /index.html;
    }
}
```

Pastikan HTTPS aktif (misalnya lewat `certbot --nginx`). Midtrans mewajibkan HTTPS untuk notifikasi pembayaran.

### 4. Proses latar belakang (wajib)

**Queue worker** mengirim email konfirmasi. Tanpa ini, email tidak terkirim. Contoh config Supervisor, `/etc/supervisor/conf.d/poonya-worker.conf`:

```ini
[program:poonya-worker]
command=php /var/www/poonya/backend/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=www-data
stdout_logfile=/var/www/poonya/backend/storage/logs/worker.log
```

**Scheduler** menyiapkan slot 30 hari ke depan, mengecek booking kadaluarsa, dan membersihkan token login lama. Tambahkan di `crontab -e`:

```cron
* * * * * cd /var/www/poonya/backend && php artisan schedule:run >> /dev/null 2>&1
```

Booking kadaluarsa dan pembuatan slot tetap berjalan walaupun cron belum dipasang. Tapi email **wajib** pakai queue worker.

Setiap kali update kode: `php artisan migrate --force && php artisan config:cache && php artisan queue:restart`, lalu jalankan `npm run build` lagi.

---

## Midtrans

1. Ambil key di dashboard Midtrans, di **Settings → Access Keys**. Untuk testing, pakai dashboard.sandbox.midtrans.com.
2. **Server key** (`SB-Mid-server-…` untuk sandbox, `Mid-server-…` untuk produksi) diisi di `.env` sebagai `MIDTRANS_SERVER_KEY`.
3. **Client key** dan mode **Sandbox/Production** diatur di panel admin, menu **Settings**. Halaman itu menampilkan peringatan merah kalau server key tidak cocok dengan mode yang dipilih.
4. Di dashboard Midtrans, buka **Settings → Payment → Notification URL**, lalu isi:
   `https://poonya.studio/api/webhooks/payment/midtrans`

Tanpa Notification URL, pembayaran tidak akan terkonfirmasi otomatis dan booking akan kadaluarsa.

---

## Fitur

**Customer:** booking dengan alur yang nyaman di HP, harga weekend, kode promo, pembayaran Midtrans, email konfirmasi, serta halaman **Cek Booking** (lihat status dan ubah jadwal 1×, paling lambat 24 jam sebelum sesi).

**Admin:**

| Menu | Isi |
|---|---|
| Dashboard | Pendapatan per bulan dan per studio, sesi hari ini, peringatan refund, export Excel |
| Bookings | Daftar dan filter booking, konfirmasi, batal, filter **Perlu Refund** → tandai sudah di-refund, export Excel |
| Studio | Data studio, harga weekday/weekend, foto |
| Jadwal | Jam operasional, hari libur, blokir slot |
| Payment | Booking walk-in (cash atau QRIS) |
| Promo | Kode promo persen atau potongan, dengan kuota dan masa berlaku |
| Accounts | Akun admin/staff dan hak akses per menu, reset 2FA |
| Email | Akun email pengirim (SMTP) dan tombol kirim tes |
| Settings | Client key Midtrans dan mode Sandbox/Production |
| Keamanan Akun | Verifikasi 2 langkah (Google Authenticator/Authy) |

Hak akses staff dicek di backend, bukan hanya dengan menyembunyikan menu.
