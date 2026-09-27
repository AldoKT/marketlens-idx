# SIGNAL workspace redesign

Keempat referensi lokal dalam `docs/references/` diperiksa langsung sebagai gambar sebelum implementasi. Komposisi landing mengikuti hierarki mockup: IHSG di kiri, shortlist investigasi di kanan, dengan topbar pencarian. Referensi aplikasi pasar dipakai untuk skala chart dan pemisahan panel.

## Layout dan sumber informasi

- Desktop: workspace selebar layar, dibatasi 1920 px; IHSG dan shortlist berdampingan. Tidak ada sidebar atau navigasi dekoratif.
- Laptop/mobile: panel turun menjadi satu kolom pada lebar 900 px. Pencarian mendapat baris penuh pada mobile. Tabel digulir di dalam panel; halaman tidak melebar horizontal.
- Detail: header ticker/tanggal/status/jumlah kriteria, chart di kiri, tiga kriteria dan seluruh bukti mendukung/bertentangan terbuka di kanan. Laporan enam tahap SIGNAL dan seluruh pengamatan tetap tersedia di bawah.
- IHSG: SVG responsif dengan rentang Y dari data, grid dan label tanggal, readout pointer/keyboard, serta tabel. Tidak menampilkan OHLC atau periode intraday. Periode/sesi mengikuti respons.
- Chart saham tetap memakai Lightweight Charts dengan candle, volume, MA5/20, ringkasan teks, date selector, dan tabel. Perubahan hanya ukuran/warna/penempatan; validasi OHLC dan perhitungan MA tetap di `chart-data.ts`.
- Aturan investigasi, report generator, ranking, route API, bentuk respons, TTL cache, dan pemuatan manual tidak diubah. `Workspace.tsx` hanya menyatukan identitas visual dan label.

## Perbedaan yang disengaja dari mockup

Tidak menyalin angka, tanggal, nama perusahaan, tanggal masuk watchlist, periode 1M/3M, panel investigasi terbaru, menu screener, atau data lain yang belum tersedia. Universe tetap berasal dari satu konfigurasi BBCA/BBRI/TLKM. Status memakai nilai asli respons. Tidak menambahkan running trade, order book, berita, broker queue, atau transaksi.

## Preview dan screenshot

Jalankan `node testing/chart-preview.cjs --market`, lalu buka `http://127.0.0.1:4313/?scenario=full`. Setelah mengganti kode, restart preview. Tekan **Muat kondisi pasar**; untuk detail buka kartu lalu tekan **Analisis**. Mode `partial`, `empty`, `error`, `load-error`, `short`, dan `index-error` tersedia melalui query/dropdown.

Preview memakai komponen aplikasi dan CSS workspace yang sama. Banner selalu menandai fixture sintetis. Jalur IHSG sintetis memiliki pembalikan arah untuk memeriksa skala/hover; ini bukan histori IHSG. Ada delay fixture 250 ms agar loading/disabled state dapat diperiksa. Preview tidak mengimpor adapter Sectors, tidak membaca env, dan memblokir koneksi data melalui CSP serta fetch guard.

Screenshot Chrome, device scale factor 1, zoom 100%:

- [Landing sebelum pemuatan, 1440×1000](screenshots/redesign-landing-empty-desktop-100.png)
- [Landing hasil fixture, 1440×1000](screenshots/redesign-landing-desktop-100.png)
- [Landing lebar, 1920×1000](screenshots/redesign-landing-wide-100.png)
- [Detail chart dan bukti, 1440×1000](screenshots/redesign-detail-desktop-100.png)
- [Landing mobile, 390 px, halaman penuh](screenshots/redesign-landing-mobile.png)
- [Detail mobile, 390 px, halaman penuh](screenshots/redesign-detail-mobile.png)
- [Detail mobile, viewport 390×844](screenshots/redesign-detail-mobile-viewport.png)

Mobile memerlukan scroll untuk membaca seluruh chart/bukti/laporan. Screenshot halaman penuh detail panjang karena seluruh laporan dipertahankan. Readout IHSG berada di atas plot agar tidak menutupi garis atau terpotong pada mobile. Sumbu harga menyesuaikan rentang data, bukan dimulai dari nol.

## Verifikasi offline

`node testing/preview-browser.cjs` memeriksa desktop 1440/1920, laptop 1280/1024, tablet 768, serta mobile 390/360; loading, full, partial, empty, error, data kurang, kegagalan IHSG, pencarian invalid/valid, link kartu/deep link/reload, chart/canvas, pointer dan keyboard, fokus, tabel, dan overflow. Browser memblokir semua host eksternal dan `/api/*` serta menegaskan jumlah request terlarang nol. Kegagalan chunk masih menghasilkan panel diagnostik.

Pemeriksaan lain: `npx tsc --noEmit`, ESLint pada komponen/preview/test terkait, `node testing/session1.cjs`, `node testing/session2.cjs`, `node testing/session3.cjs`, dan `git diff --check`. Tidak menjalankan smoke test live, commit, push, atau deploy.
