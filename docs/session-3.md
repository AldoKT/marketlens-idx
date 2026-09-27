# Sesi 3: landing, IHSG, dan daftar pantauan

## Alur

- `/` adalah landing SIGNAL: penjelasan produk, pencarian ticker, kondisi IHSG, daftar Kandidat untuk Dipantau, dan hasil universe lainnya.
- Halaman awal tidak mengambil data. Klik **Muat kondisi pasar** memanggil `POST /api/market` satu kali. Tombol dijaga dari klik ganda saat permintaan masih berlangsung. Tidak ada polling, fetch dalam effect, atau sumber Sectors yang dipanggil saat import/render/prefetch.
- Pencarian empat huruf dinormalisasi ke uppercase lalu menuju `/analyze/[symbol]`. Detail tidak memuat data sampai tombol **Analisis** ditekan. Candle, volume, MA 5/20, laporan, bukti, dan watchNext Sesi 1–2 tetap tersedia.
- Link internal memakai `prefetch={false}`. Halaman detail server hanya membaca Promise params dan memvalidasi ticker, tanpa membaca key atau mengambil data.
- Penggabungan harga/flow dipindah ke `createStockAnalysis`; endpoint detail dan overview menggunakan fungsi tersebut beserta `analyzeMarket` dan `createMarketReport` yang sama. Aturan investigasi dan implementasi PriceChart tidak berubah dalam sesi ini.

## Universe dan urutan

Satu konfigurasi `src/lib/market-config.ts` menetapkan **BBCA, BBRI, TLKM** (3 ticker), dengan batas maksimal 5. Tidak ada endpoint enumerasi universe atau simbol dari input pengguna pada loader pasar. Loader menolak universe berlebih/duplikat/ticker invalid sebelum mengakses sumber.

Urutan: **criteriaMet menurun, lalu ticker A–Z**. Tie-break tidak bergantung urutan respons atau kecepatan request. `candidate` dan `unconfirmed` masuk daftar pantauan; `not_matching` dan `insufficient_data` tampil pada Hasil universe lainnya, tanpa mengubah arti status Sesi 1. Semua kartu memuat status, jumlah kriteria, tanggal terakhir, bukti mendukung/bertentangan, dan tautan detail. Ini bukan peringkat return atau probabilitas cuan. Tanggal antar saham dapat berbeda; tidak dipaksakan menjadi tanggal hari ini.

`Promise.allSettled` memisahkan kegagalan IHSG dan tiap ticker. Respons `complete`, `partial`, atau `error` selalu menyimpan daftar kegagalan dan hasil yang berhasil. Tidak ada retry otomatis. Data yang kurang tetap berstatus investigasi insufficient_data, berbeda dari kegagalan pengambilan. Jika request browser gagal saat reload manual, hasil sebelumnya tetap tampil dengan tanggal sumber.

## IHSG

Dokumentasi [Index Daily Transaction Data](https://docs.sectors.app/api-references/v2/indonesia/transaction/index-daily) menyebut penutupan dalam field **price**. Adapter memetakannya menjadi close untuk UI. Tidak ada OHLC atau candle IHSG. Grafik garis SVG memiliki tanggal, skala poin, ringkasan teks, title per titik, dan tabel alternatif.

Kondisi naik/turun/tetap hanya membandingkan dua penutupan valid terakhir; perubahan poin dan persentase diberi tanggal pembanding. Satu sesi belum cukup untuk perubahan. Data bertanggal invalid, penutupan nonpositif/nonfinite, dan tanggal duplikat diabaikan serta dihitung. Tidak ada pengisian hari libur atau penjelasan sebab pergerakan. Tanggal historis tetap terlihat ketika dibuka pada akhir pekan.

## Anggaran dan cache

| Sumber | Jumlah cold request | Kredit terdokumentasi per request |
| --- | ---: | ---: |
| IHSG index-daily | 1 | 1 |
| daily 3 ticker | 3 | 1 |
| foreign-flow 3 ticker | 3 | 1 |
| Total universe saat ini | **7** | **Estimasi 7 kredit** |

Rumus maksimum aplikasi adalah `1 + 2 × N`; konfigurasi maksimal 5 ticker berarti 11 permintaan, sedangkan konfigurasi aktif 3 berarti 7. Detail yang dimuat terpisah membutuhkan paling banyak 2 permintaan/estimasi 2 kredit saat cache kosong. Estimasi tidak mengukur tagihan aktual, penagihan kegagalan, atau sisa kuota akun. Selama sesi pengembangan ini **tidak ada request Sectors live**.

Referensi biaya: [daily](https://docs.sectors.app/api-references/v2/indonesia/transaction/daily), [foreign-flow](https://docs.sectors.app/api-references/v2/indonesia/brokers/foreign-flow-by-symbol), [index-daily](https://docs.sectors.app/api-references/v2/indonesia/transaction/index-daily). Ketiganya menyebut 1 API credit.

Adapter server bersama memakai Next Data Cache: `cache: force-cache`, `next.revalidate: 86400` (24 jam). Key server hanya dibaca ketika handler dipanggil; tidak masuk bundle client atau respons. Harga/flow memakai URL/options sama untuk detail dan landing. Setiap fetch memiliki timeout 20 detik dan redirect ditolak; aplikasi tidak melakukan retry/pagination tambahan. Respons agregat POST tidak dicache di browser (`Cache-Control: no-store`), tetapi sumber GET tetap memakai Data Cache server.

Dokumentasi lokal Next 16.3.6 di `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md` sudah diperiksa. Pada production, response HTTP 200 dapat dipakai ulang sampai revalidasi/eviksi. Cache miss/stale, deploy baru, cache tidak persisten/terpisah antar instance, key berubah, atau request serentak dapat memicu sumber lagi. **Cache tidak menjamin nol kredit setiap deploy/instance.** Di development, hard refresh/DevTools no-cache dapat mengabaikan opsi cache; cache HMR Server Components tidak sama dengan cache Route Handler. Build/HMR/navigasi halaman ini tidak mempunyai kode pemuatan sumber; data hanya diminta lewat tindakan eksplisit. TTL 24 jam dapat menahan data sesi sebelumnya dan tanggal sumber menjadi rujukan kesegarannya.

## Verifikasi offline

```sh
npx tsc --noEmit
node testing/session1.cjs
node testing/session2.cjs
node testing/session3.cjs
node node_modules/eslint/bin/eslint.js src/app/page.tsx src/app/layout.tsx "src/app/analyze/[symbol]/page.tsx" src/app/api/analyze/route.ts src/app/api/market/route.ts src/components/StockAnalysis.tsx src/components/MarketLanding.tsx src/components/IndexChart.tsx src/lib/market-config.ts src/lib/market-overview.ts src/lib/stock-analysis.ts src/lib/sectors.ts testing/fixtures/market.ts testing/market-preview.tsx testing/chart-preview.cjs testing/offline-load.cjs testing/session3.cjs
git diff --check
git status --short
```

Sesi 3 memeriksa ranking dan tie, tanggal/angka IHSG, pemetaan price, batas universe sebelum request, anggaran 7 fetch mock, opsi cache/TTL, parsial/satu saham gagal, IHSG gagal/kosong, seluruh sumber gagal, kandidat kosong, data kurang, serta render React SSR landing/detail tanpa memanggil loader. Mock fetch adapter tidak mengakses jaringan. Fixture universe baru memakai label BBCA/BBRI/TLKM dengan **angka sintetis**, bukan data BBCA historis dari sesi sebelumnya; fixture historis BBCA belum tersedia.

## Validasi browser tanpa API atau env

```sh
node testing/chart-preview.cjs --market
```

Buka `http://127.0.0.1:4313`. Preview webpack memakai komponen asli dan loader fixture lokal; tidak menjalankan Next, mengimpor route API/server adapter, atau memuat `.env.local`. CSP `connect-src 'none'` dan fetch guard melarang koneksi data. File bundle temporer berada di direktori temp sistem. Pencarian/link detail disimulasikan lokal; reload URL `/analyze/BBCA` tetap memakai fixture.

1. Pada halaman awal, IHSG/kandidat belum dimuat. Tekan Muat kondisi pasar untuk memuat fixture.
2. Uji skenario Normal + tie, BBRI gagal, Tanpa kandidat, Data kurang, IHSG gagal, Semua gagal, dan Request landing gagal dari dropdown. Setelah mengganti skenario, tekan tombol pemuatan.
3. Cari ticker atau buka kartu; detail belum dimuat sampai tombol Analisis ditekan. Periksa candle/MA/volume, laporan, crosshair, tabel, dan tautan beranda.
4. Uji keyboard Tab/Enter, fokus terlihat, pencarian invalid, panah/Home/End pada chart, serta lebar mobile/desktop. Mount/unmount dalam StrictMode tersedia.
5. Panel Network tidak boleh mengandung request `/api/market`, `/api/analyze`, atau host Sectors. Hanya HTML/JS lokal dimuat; preview tidak menjalankan cache Next dan tidak membuktikan penghematan kredit production.

Kompilasi preview dan pemeriksaan HTTP lokal berhasil. Setelah perbaikan preview, pengujian Chrome headless di bawah memverifikasi render client dan interaksi nyata. Hindari menjalankan dev/build sebagai pengganti preview offline, karena Next dapat memuat env dan font eksternal.

## Perbaikan halaman kosong pada preview standalone

## Polesan UI offline

Shortlist sekarang mendahului konteks IHSG. Ketiga kartu beserta tanggal, status, jumlah kriteria, ringkasan dukungan/kontradiksi, dan tautan detail muat pada viewport desktop 1280×900 dengan zoom 100%. Angka/periode bukti lengkap tetap tersedia melalui disclosure setiap kartu. Grafik IHSG dibatasi lebarnya. Pada mobile 390×844 kartu disusun vertikal; bagian awal kartu pertama terlihat, selebihnya melalui scroll, terutama karena banner fixture dan kontrol preview tetap ditampilkan.

Detail diawali status, jumlah kriteria, satu kalimat kesimpulan dan anchor ke chart/bukti/laporan. Seluruh evidence, counter-evidence, ringkasan asli dan enam bagian SIGNAL tersedia di bawah. Informasi request/kredit/cache dipindahkan ke disclosure metodologi. Tidak ada perubahan aturan, ranking, fetch, atau respons API.

Chrome offline memeriksa pencarian ticker, link/deep link/reload, fokus anchor bukti, Home pada chart, tabel ber-caption/column header, canvas nyata, mobile tanpa overflow halaman, serta hasil parsial/error. Desktop memakai deviceScaleFactor 1 dan visualViewport.scale 1. Screenshot viewport: [landing desktop 100%](screenshots/session3-landing-desktop-100.png), [detail desktop 100%](screenshots/session3-detail-desktop-100.png), [landing mobile](screenshots/session3-landing-mobile.png), [detail mobile](screenshots/session3-detail-mobile.png). Semua data sintetis.

TypeScript, regresi offline Sesi 1–3, Chrome dan lint komponen/test yang berubah lulus. `npm run lint` global masih melaporkan 12 pelanggaran `no-require-imports` di script CommonJS lama `testing/session1.cjs` dan `testing/session2.cjs`; tidak diubah untuk polesan UI ini.

### Diagnosis preview sebelumnya

Error direproduksi di Chrome: **`ReferenceError: process is not defined`**. HTML dan `/chart.js` sama-sama HTTP 200, CSS dark theme termuat, tetapi bundle awal mengimpor `next/link` beserta referensi `process.env.__NEXT_*`. Preview menjalankan webpack mandiri, tanpa transformasi environment/router dari Next; import gagal sebelum `createRoot` merender apa pun. Ini render client baru pada root kosong, bukan mismatch hydration. SSR test sebelumnya tidak menangkapnya karena Node memiliki `process` dan tidak menjalankan lifecycle browser.

Webpack preview kini mengalias **hanya** `next/link` ke `testing/preview-link.tsx` (anchor standar). Komponen production tetap memakai Next Link. Entry bootstrap menginstal guard jaringan dan pelaporan error sebelum dynamic import React/komponen; kegagalan chunk/runtime menjadi panel error yang terlihat. HTML menggunakan head/body eksplisit dan script defer; server memisahkan pathname dari query string agar URL skenario dan deep link tidak 404. Port yang sedang dipakai menampilkan petunjuk restart, bukan mematikan server lain.

Setelah menghentikan preview lama dengan **Ctrl+C**, jalankan lagi:

```sh
node testing/chart-preview.cjs --market
```

| Skenario | URL |
| --- | --- |
| Normal + tie | `http://127.0.0.1:4313/?scenario=full` |
| Parsial, BBRI gagal | `http://127.0.0.1:4313/?scenario=partial` |
| Tanpa kandidat | `http://127.0.0.1:4313/?scenario=empty` |
| Semua sumber gagal | `http://127.0.0.1:4313/?scenario=error` |
| Request landing gagal | `http://127.0.0.1:4313/?scenario=load-error` |
| Data kurang | `http://127.0.0.1:4313/?scenario=short` |
| IHSG gagal | `http://127.0.0.1:4313/?scenario=index-error` |
| Detail BBCA sintetis | `http://127.0.0.1:4313/analyze/BBCA?scenario=full` |

Setiap URL langsung menampilkan UI tanpa API. Tekan **Muat kondisi pasar** untuk melihat hasil fixture skenario; pada detail tekan **Analisis**. Query scenario dipertahankan saat navigasi/back/reload. Jika port 4313 masih digunakan, `--port=4314` menyediakan preview pada port alternatif (ubah port pada URL di atas).

Regresi browser:

```sh
node testing/preview-browser.cjs
```

Test memerlukan Chrome terpasang dan Playwright devDependency, menjalankan server fixture sendiri pada port sementara, tanpa Next/env. Skenario normal/parsial/kosong/error/load-error diuji lewat klik pengguna; seluruh API path dan host eksternal diblokir. Test juga memeriksa status dokumen/JS, CSP, CSS, runtime/console, navigasi/reload detail, canvas candlestick nyata, lebar mobile, dan panel diagnostik saat chunk sengaja gagal. Screenshot desktop tiap skenario dan mobile disimpan pada direktori temp yang dicetak oleh test. Tidak ada fitur produk atau aturan investigasi yang diubah oleh perbaikan ini.
