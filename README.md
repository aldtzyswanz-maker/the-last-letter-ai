# THE LAST LETTER — AI Mystery (prototipe multiplayer)

Versi ini memisahkan **frontend statis** dari **backend AI**. Frontend bisa dipasang di GitHub Pages; backend Worker menyimpan kode ruang dan memanggil Cloudflare Workers AI. API key provider tidak diletakkan di browser.

## Fitur
- Kasus baru dihasilkan AI, dengan 4 tersangka, kepribadian, rahasia, kronologi dan solusi rahasia.
- Interogasi bebas: pemain mengetik pertanyaan sendiri dan memilih karakter.
- AI berperan sebagai tersangka atau partner penyelidikan.
- Ruang 2 pemain dengan kode undangan; kedua pemain melihat riwayat chat dan bukti bersama.
- Evaluasi tuduhan berdasarkan solusi kasus yang dibuat pada awal permainan.
- Ruang otomatis kedaluwarsa setelah 24 jam; riwayat terbaru dibatasi.

## Catatan penting
Ini prototipe: model AI bisa menghasilkan JSON tidak valid, melupakan detail, atau membuat kesalahan. Ada fallback jika pembuatan kasus gagal. Penyimpanan KV bukan database transaksional, sehingga dua aksi yang terjadi persis bersamaan bisa menimpa perubahan. Untuk rilis publik, tambahkan rate limiting, validasi lebih ketat, autentikasi/anti-abuse, dan database dengan transaksi. Jangan menyimpan data pribadi.

## 1. Buat backend Cloudflare
1. Buat akun Cloudflare dan pasang Node.js versi LTS di komputer.
2. Buka terminal dalam folder ini, lalu jalankan `npm install -g wrangler` dan `wrangler login`.
3. Di dashboard Cloudflare, buka **Workers & Pages → KV** lalu buat namespace, misalnya `THE_LAST_LETTER_ROOMS`.
4. Salin ID namespace ke `wrangler.toml` menggantikan `GANTI_DENGAN_KV_NAMESPACE_ID`. Untuk `preview_id`, buat namespace preview lain atau hapus baris `preview_id` bila tidak diperlukan.
5. Pastikan akun Cloudflare memiliki akses Workers AI. Pada konfigurasi ini model yang dipakai adalah `@cf/meta/llama-3.1-8b-instruct`; ketersediaan model dan kuota gratis bergantung pada kebijakan akun/Cloudflare saat deployment.
6. Deploy backend dengan `wrangler deploy`. Simpan URL Worker yang ditampilkan, misalnya `https://the-last-letter-api.NAMA_AKUN.workers.dev`.
7. Tes `https://URL-WORKER/api/health`; seharusnya menampilkan `ok`, `ai`, dan `storage` bernilai true.

> Jangan pernah memasukkan token Cloudflare atau rahasia akun ke file frontend atau GitHub. Binding Workers AI bukan API key browser. Cek dashboard untuk batas penggunaan dan biaya terkini sebelum membagikan situs secara luas.

## 2. Publikasikan frontend di GitHub Pages
1. Buat repo publik bernama `the-last-letter`.
2. Unggah `index.html` dari folder ini ke root repo.
3. Edit `index.html`: ubah baris `const API_BASE = '';` menjadi URL Worker, tanpa garis miring di akhir, contoh `const API_BASE = 'https://the-last-letter-api.NAMA_AKUN.workers.dev';`.
4. Commit perubahan.
5. Repo → **Settings → Pages → Deploy from a branch → main → /(root) → Save**.
6. Buka URL Pages yang diberikan GitHub.

## 3. Uji multiplayer
1. Pemain pertama buka URL Pages, masukkan nama, pilih jenis kasus, lalu klik **Buat kasus baru & ruang**.
2. Klik **Salin kode undangan**, kirim tautan/kode kepada pemain kedua.
3. Pemain kedua buka tautan, masukkan nama, dan klik **Gabung ruang** jika belum otomatis bergabung.
4. Keduanya dapat menginterogasi karakter; tampilan diperbarui setiap 2,5 detik.

## Troubleshooting
- **Binding AI belum diatur**: pastikan `[ai] binding = "AI"` ada di `wrangler.toml` dan deploy ulang.
- **Ruang tidak ditemukan**: pastikan KV namespace ID benar dan Worker sudah ter-deploy; ruang kedaluwarsa setelah 24 jam.
- **CORS/network error**: pastikan `API_BASE` persis URL Worker `https://...workers.dev` tanpa slash terakhir.
- **AI error/limit**: cek dashboard Workers AI dan kuota akun. Model gratis/kuota dapat berubah; hindari polling atau percakapan berlebihan.
- **Pemain kedua tidak masuk**: maksimal dua pemain di prototipe; gunakan kode yang sama.
