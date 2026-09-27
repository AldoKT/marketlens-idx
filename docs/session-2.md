# Sesi 2: grafik analisis saham

`PriceChart` memakai TradingView Lightweight Charts 5.2.1 sebagai komponen client. API versi 5 (`createChart`, `addSeries`, panes, crosshair, `autoSize`) sudah diperiksa pada dokumentasi resmi dan deklarasi tipe paket. Import library dilakukan dalam effect; cleanup melepaskan chart dan subscription, termasuk ketika komponen dilepas sebelum import selesai. Tidak ada React wrapper tambahan.

- Candle 1D berasal langsung dari date/open/high/low/close records respons API yang sudah ada. Semua harga harus finite dan positif; low <= open/close <= high. OHLC kosong atau tidak valid menjadi whitespace, tanpa harga pengganti. Volume valid tetap dapat tampil ketika OHLC tidak tersedia.
- MA 5/20 adalah simple moving average dari close sesi tersedia yang diurutkan berdasarkan tanggal. Tidak ada nilai sebelum 5/20 close valid tersedia. Close invalid mengosongkan semua jendela yang memuatnya; indikator pulih setelah jendela lengkap berikutnya. Segmen garis dipisah agar tidak menghubungkan jendela invalid.
- Tanggal kalender invalid diabaikan dan dihitung. Tanggal duplikat menjadi satu slot kosong karena datanya ambigu. Volume harus finite dan >= 0; nol tetap valid.
- Semua sesi respons dipakai, bukan hanya 10 sesi terakhir. Tema gelap, skala harga/tanggal, crosshair dengan rincian teks di bawah grafik, volume di pane kedua, resize otomatis, serta zoom/pan tersedia.
- Naik memakai badan kosong, turun badan penuh; arah juga tertulis dalam rincian dan tabel. MA 5 memakai garis utuh dan MA 20 putus-putus. Ringkasan, pemilihan tanggal keyboard, navigasi panah/Home/End, fokus terlihat, tabel semantik, dan fallback kegagalan library disediakan.
- Fetch halaman tetap hanya dalam submit tombol Analisis. Route, aturan investigasi, chart indikator server, dan landing page tidak diubah. Tidak ada request indikator atau data tambahan.

## Cek offline

```sh
npx tsc --noEmit
node testing/session1.cjs
node testing/session2.cjs
node node_modules/eslint/bin/eslint.js src/components/PriceChart.tsx src/lib/chart-data.ts src/app/page.tsx testing/fixtures/chart.ts testing/chart-preview.tsx
```

Skrip Sesi 2 memblokir fetch, memeriksa angka MA termasuk warm-up/pemulihan, OHLC invalid/null, volume nol/invalid, urutan/duplikat/tanggal invalid, serta render React SSR dari komponen asli untuk fixture normal, invalid, satu sesi, dan kosong. Regresi Sesi 1 tetap lulus.

Preview manual terisolasi:

```sh
node testing/chart-preview.cjs
```

Buka `http://127.0.0.1:4312`. Server ini memakai fixture TEST lokal, tidak menjalankan Next, tidak memuat env, dan memblokir koneksi data dengan CSP `connect-src 'none'` serta fetch guard. Tombol menyediakan 30 sesi, 4 sesi, invalid, kosong, dan mount/unmount dalam React StrictMode. Bundle temporer berada di direktori temp sistem. Tidak ada fixture BBCA tersedia dari sesi sebelumnya.

## Batas dan verifikasi visual

Lingkungan agen tidak menyediakan browser Chrome atau in-app browser, sehingga pemeriksaan visual, crosshair nyata, fokus keyboard, dan resize di browser belum dapat dilakukan. Kompilasi preview offline berhasil; perhitungan dan SSR diperiksa otomatis. Canvas bukan representasi screen-reader yang lengkap; ringkasan dan tabel adalah alternatif aksesibel.

Chart mengikuti records route lama yang merupakan irisan tanggal harga dan foreign flow. Tidak mengisi sesi yang hilang atau menebak kalender bursa, tidak memverifikasi penyesuaian stock split, dan tidak menyediakan data intraday. Label volume tidak mengasumsikan lot atau lembar karena satuan sumber belum diverifikasi. MA dihitung atas sesi dalam respons; ketiadaan MA 20 pada respons pendek merupakan perilaku yang disengaja. Volume bukan bukti otomatis akumulasi.

Referensi: [Getting started v5](https://tradingview.github.io/lightweight-charts/docs), [React integration](https://tradingview.github.io/lightweight-charts/tutorials/react/simple), [IChartApi](https://tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApi).
