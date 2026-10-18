# Web Kasir Koperasi

Monorepo MERN dengan TypeScript untuk aplikasi kasir koperasi. `apps/api` berisi REST API Express dan Mongoose; `apps/web` berisi React, Redux Toolkit, Tailwind CSS, dan komponen UI bergaya shadcn/ui. Mata uang disimpan sebagai bilangan bulat rupiah; browser tidak menjadi sumber harga, pajak, stok, atau saldo.

## Struktur

```text
.
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── config/       # validasi env, MongoDB, logger
│   │       ├── middleware/   # auth/RBAC, CSRF, validasi, error handler
│   │       ├── models/       # skema Mongoose dan indeks
│   │       ├── routes/       # endpoint REST per domain
│   │       ├── schemas/      # kontrak Zod
│   │       ├── scripts/      # bootstrap admin pertama
│   │       └── utils/        # audit log, async handler, error
│   └── web/
│       └── src/
│           ├── app/          # Redux store
│           ├── components/ui # komponen UI dasar gaya shadcn
│           ├── features/     # auth, POS, laporan, label produk
│           ├── services/     # RTK Query API
│           └── lib/          # format rupiah dan utilitas
├── infra/mongo/              # inisialisasi replica set untuk lokal
├── docker-compose.yml
└── .env.example
```

## Menjalankan lokal

1. Pasang Node.js 20.18+ dan pnpm 9.15.4. Jika pnpm belum tersedia, aktifkan lewat Corepack: `corepack enable`.
2. Salin `.env.example` menjadi `.env` di folder root. Isi `JWT_SECRET` dengan nilai acak minimal 32 karakter. Atur `WEB_ORIGIN`, `MONGODB_URI`, `SALES_TAX_RATE_BPS` (basis point; `1100` berarti 11%), dan zona waktu operasional.
3. Pasang dependency: `pnpm install`.
4. Jalankan MongoDB replica set lokal: `docker compose up -d`. Replica set diperlukan karena checkout, perubahan saldo, stok, dan audit log memakai transaksi MongoDB.
5. Untuk akun administrator pertama, isi sementara `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, dan `INITIAL_ADMIN_PASSWORD` pada `.env` (minimal 12 karakter), lalu jalankan `pnpm --filter @koperasi/api seed:admin`. Hapus nilai password bootstrap setelah akun terbentuk. Skrip menolak membuat ulang email yang sudah terdaftar.
6. Jalankan API dan web: `pnpm dev`. Web tersedia di `http://localhost:5173`, API di `http://localhost:4000/api/v1`.

Endpoint API memakai awalan `/api/v1`. Konfigurasi replica set Compose ini untuk API yang berjalan di host lokal (bukan di container). Pada produksi, gunakan replica set terkelola dan sajikan web/API melalui satu site/origin agar cookie `SameSite=Strict` berfungsi tanpa mengubah kebijakan menjadi lintas-site.

## Alur implementasi

1. **Konfigurasi server:** `config/env.ts` memvalidasi variabel lingkungan saat startup. `app.ts` memasang Helmet, whitelist CORS, batas ukuran JSON, compression, cookie parser, rate limit, CSRF, dan error handler. `index.ts` menunggu MongoDB sebelum membuka port dan menangani shutdown.
2. **Data dan indeks:** `Product` mengindeks SKU/barcode, pencarian teks, kategori, dan flag `lowStock` yang dihitung ulang pada perubahan stok; `Member` memisahkan simpanan wajib dan sukarela; `Transaction` menyimpan snapshot nama/harga/HPP pada waktu penjualan. Snapshot membuat struk dan laporan historis tetap konsisten saat katalog berubah. Riwayat saldo anggota dan audit disimpan sebagai ledger append-only.
3. **Checkout aman:** server membaca ulang harga, menghitung pajak dari konfigurasi server, memeriksa stok, menerima saldo sukarela anggota atau tunai, lalu menyimpan transaksi, mutasi stok/saldo, poin, dan audit dalam satu MongoDB transaction. Checkout mewajibkan idempotency key agar klik ulang atau retry jaringan tidak menggandakan penjualan.
4. **Login dan RBAC:** password di-hash dengan bcrypt. Access JWT dan refresh token rotasi disimpan dalam cookie HTTP-only; cookie CSRF terpisah harus disertakan di header untuk permintaan mutasi. Access token berumur pendek. Refresh token disimpan sebagai hash di `AuthSession` dan dirotasi saat refresh. Role diperiksa di route API, bukan hanya disembunyikan di UI.
5. **Frontend:** RTK Query mengelola request/cache API; slice Redux mengelola keranjang sementara. `useDeferredValue` menunda pencarian agar input kasir responsif. Harga, pajak, stok, dan saldo selalu diverifikasi ulang backend. Layout Tailwind dimulai dari layar kecil; komponen di `components/ui` mengikuti pola shadcn/ui. Konfigurasi generator ada di `apps/web/components.json`; dari folder `apps/web`, tambahkan komponen resmi dengan `pnpm dlx shadcn@latest add dialog table`.
6. **Laporan dan perangkat:** endpoint laporan menerima rentang tanggal dalam zona waktu koperasi; React menampilkan grafik dan menyediakan ekspor Excel/PDF. Struk memakai dialog cetak browser dengan lebar thermal 80 mm. Komponen `ProductLabel` siap dipasang pada layar katalog untuk membuat barcode dan QR.

## Endpoint yang disediakan

| Area | Endpoint utama | Akses |
|---|---|---|
| Sesi | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | Pengguna |
| Konfigurasi POS | `GET /config/checkout` | Pengguna |
| Pengguna | `GET/POST /users`, `PATCH /users/:id` | Admin |
| Produk/stok | `GET/POST /products`, `PATCH/DELETE /products/:id`, `POST /products/:id/stock-adjustments`, `GET /products/low-stock` | Baca: semua; ubah: admin/pengurus |
| Kategori | `GET/POST /categories`, `PATCH/DELETE /categories/:id` | Baca: semua; ubah: admin/pengurus |
| Anggota | `GET/POST /members`, `PATCH/DELETE /members/:id`, `GET /members/:id/ledger`, `POST /members/:id/savings-deposits` | Baca: semua; ubah: admin/pengurus |
| POS | `POST /transactions/checkout`, `GET /transactions`, `POST /transactions/:id/void` | Checkout: semua; daftar/batal: admin/pengurus |
| Laporan/kas | `GET /reports/sales`, `/reports/cash-movements`, `/reports/audit-logs`, `POST /cash-movements` | Laporan: admin/pengurus; mutasi kas: pengguna |

### Matriks role

| Kemampuan | Admin | Kasir | Pengurus |
|---|:---:|:---:|:---:|
| Menjual tunai atau saldo sukarela dan memperoleh poin anggota | ✓ | ✓ | ✓ |
| Membaca katalog dan mencari anggota | ✓ | ✓ | ✓ |
| Mengelola produk, kategori, stok, dan anggota | ✓ |  | ✓ |
| Menyetor simpanan anggota dan membatalkan transaksi dengan alasan | ✓ |  | ✓ |
| Melihat laporan, audit, dan riwayat kas | ✓ |  | ✓ |
| Membuat/mengubah akun dan role pengguna | ✓ |  |  |

## Keamanan dan operasional produksi

- Deploy hanya di HTTPS; set `COOKIE_SECURE=true`, batasi `WEB_ORIGIN` ke origin frontend yang tepat, dan isi `COOKIE_DOMAIN` hanya bila memang diperlukan. Gunakan secret manager untuk JWT dan bootstrap password.
- Jalankan MongoDB sebagai replica set terkelola dengan autentikasi, TLS, backup, pemulihan point-in-time, dan indeks yang dibuat lewat migrasi. Koneksi produksi menonaktifkan pembuatan indeks otomatis.
- `express-rate-limit` bawaan memakai memory store per proses. Untuk beberapa instance, ganti store dengan Redis agar batas login/API konsisten. Set `TRUST_PROXY_HOPS` sesuai jumlah reverse proxy sebenarnya (lokal: `0`, satu proxy: `1`) agar IP klien dan rate limit tidak mudah dipalsukan.
- Zod memvalidasi bentuk dan tipe input; route membentuk selector MongoDB sendiri dan tidak menerima operator/query MongoDB dari klien. Error internal tidak dikirim ke browser. Pino menyamarkan cookie dan field password/token.
- Kunci idempotensi checkout harus dipertahankan ketika mengulang request transaksi yang hasilnya belum diketahui. Jangan membuat request penjualan baru dengan key yang sama untuk isi keranjang berbeda.
- Poin saat ini bertambah 1 poin per Rp10.000 dan simpanan wajib tidak dapat digunakan untuk belanja; aturan ini perlu disesuaikan dengan keputusan koperasi. Pajak dan zona waktu juga perlu dikonfirmasi sebelum dipakai untuk pembukuan resmi.
- Cetak thermal menggunakan print dialog browser, sehingga ukuran kertas dan driver perlu diatur pada perangkat kasir. Cetak ESC/POS tanpa dialog memerlukan bridge printer lokal tepercaya dan integrasi perangkat tambahan.

Scaffold ini menyediakan jalur inti API, login, POS, laporan, keamanan, serta layar administrasi responsif untuk produk/stok/kategori, anggota/simpanan, akun pengguna/RBAC, dan kas/audit. Hak akses layar mengikuti role, sedangkan setiap operasi tetap divalidasi dan diaudit di server. Sebelum menerima transaksi riil, review aturan pajak dan pembukuan, migrasi indeks, observability, backup/restore drill, serta pipeline CI dan pengujian beban/keamanan yang sesuai operasional koperasi.
