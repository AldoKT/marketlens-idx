# Revisi kedua UI SIGNAL

Revisi ini menggantikan susunan visual pada `ui-redesign.md`, tanpa mengubah aturan investigasi, perhitungan indikator, report generator, API, cache, ranking, atau pemuatan manual.

## Perubahan informasi

- Landing: tiga row perbandingan dengan label kolom bersama, ticker/status/jumlah kriteria, satu fakta pendukung, satu alasan belum terkonfirmasi, tanggal dan tautan detail. Semua bukti asli tetap tersedia melalui **Bukti lengkap**. Header IHSG dipadatkan agar plot menjadi elemen utama; readout muncul saat hover/fokus. Validasi baris dan bantuan dipindahkan ke metodologi/disclosure.
- Detail: status dan kesimpulan singkat mendahului chart. OHLCV dan MA menjadi strip metrik, bukan paragraf. Panel kanan hanya berisi tiga kriteria, angka kunci dan satu alasan spesifik. Bukti rinci tersedia di bawah melalui tautan yang sekaligus membuka disclosure.
- Laporan: satu ringkasan harga/flow dan enam tahap dalam row berurutan, bukan grid dengan ruang kosong besar. **Metodologi dan seluruh pengamatan** mempertahankan seluruh teks laporan asli, aturan dan bukti. Pengulangan teks yang persis sama hanya ditampilkan sekali dalam arsip. Regresi memeriksa keberadaan setiap teks asli.
- Copy presentasi membedakan nama kriteria dari hasilnya: misalnya **Kriteria sideways belum terpenuhi**, bukan **Bertentangan: Harga sideways**. Penilaian tetap berasal dari respons analisis.

## File revisi ini

- `src/components/MarketLanding.tsx`
- `src/components/IndexChart.tsx`
- `src/components/StockAnalysis.tsx`
- `src/components/PriceChart.tsx`
- `src/components/investigation-display.ts` (baru; format fakta presentasi)
- `src/app/workspace.css`
- `testing/fixtures/market.ts`
- `testing/market-preview.tsx`
- `testing/preview-browser.cjs`
- `testing/session3.cjs`
- Dokumen ini dan screenshot `docs/screenshots/revision2-*.png`.

Worktree juga memuat perubahan sesi sebelumnya yang belum di-commit; daftar di atas khusus revisi kedua.

## Preview offline

Jalankan `node testing/chart-preview.cjs --market`, lalu buka:

- `http://127.0.0.1:4313/?scenario=review` — tiga saham sintetis, masing-masing 1/3 (sideways false, posisi bawah true, flow false), dihitung oleh aturan asli.
- `http://127.0.0.1:4313/?scenario=full` — variasi status/kriteria.
- `http://127.0.0.1:4313/?scenario=partial` — sebagian saham gagal.
- `http://127.0.0.1:4313/?scenario=empty` — tidak ada kandidat.
- `http://127.0.0.1:4313/?scenario=error` — semua sumber gagal.
- `http://127.0.0.1:4313/?scenario=load-error` — pemuatan gagal.

Tekan **Muat kondisi pasar**, kemudian tautan ticker dan **Analisis** untuk detail. Banner fixture sintetis tetap terlihat. Preview menggunakan komponen aplikasi yang sama, bukan tiruan UI. Tidak ada histori live BBCA dalam fixture; angka sintetis bukan salinan screenshot live.

## Hasil verifikasi

- TypeScript: `npx tsc --noEmit` lulus.
- ESLint: empat komponen UI, helper presentasi, fixture, entry preview, browser runner dan regresi Sesi 3 lulus.
- `node testing/session1.cjs`, `node testing/session2.cjs`, `node testing/session3.cjs`: lulus. Kasus histori BBCA dilewati karena fixture tersebut tidak tersedia.
- `git diff --check`: lulus.
- `node testing/preview-browser.cjs`: full, partial, empty, error, load-error, short, index-error dan review lulus; pencarian, link/deep link/reload, manual loading, canvas, keyboard/fokus, tabel dan overflow diperiksa. Kegagalan bundle tetap menampilkan diagnostik.
- Browser: nol request API/eksternal dan nol error runtime. Tidak membaca `.env.local`, menjalankan live smoke test, commit, push atau deploy.
- Zoom 100%: pada 1920x1080, batas bawah plot IHSG 683 px, shortlist 755 px, candle/volume 819 px, kriteria 714 px. Pada 1366x768: masing-masing 683, 725, 707 dan 714 px. Laporan desktop 524 px. Mobile diuji hingga 360 px tanpa overflow halaman.

## Screenshot final

| Tampilan | Desktop 1920x1080 | Laptop 1366x768 |
| --- | --- | --- |
| Landing | [Screenshot](screenshots/revision2-landing-1920x1080.png) | [Screenshot](screenshots/revision2-landing-1366x768.png) |
| Detail atas | [Screenshot](screenshots/revision2-detail-1920x1080.png) | [Screenshot](screenshots/revision2-detail-1366x768.png) |
| Laporan | [Screenshot](screenshots/revision2-report-1920x1080.png) | [Screenshot](screenshots/revision2-report-1366x768.png) |

[Landing mobile](screenshots/revision2-landing-mobile.png) dan [detail mobile](screenshots/revision2-detail-mobile.png).

Mockup dan screenshot browser dibandingkan secara visual. Setelah iterasi pertama, readout IHSG dibuat kontekstual dan ringkasan laporan dipangkas lagi untuk mengurangi pengulangan.

## Batasan yang disengaja

Tidak meniru angka ilustratif, menu tanpa fungsi, panel data yang belum tersedia, atau tombol periode palsu. Shortlist tetap memerlukan beberapa baris alasan pada laptop, dan mobile memakai susunan vertikal dengan scroll. Arsip lengkap tetap panjang ketika dibuka, tetapi tidak lagi mendominasi tampilan awal. Pemeriksaan berita/fundamental tetap dinyatakan belum dilakukan; tidak menambahkan klaim sebab pergerakan atau probabilitas keuntungan.
