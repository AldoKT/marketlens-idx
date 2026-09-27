# Sesi 1: Sideways Accumulation Watch

Respons route yang sudah ada (`src/app/api/analyze/route.ts`) otomatis memakai hasil library baru. Tidak ada endpoint atau fetch tambahan. `analysis.price`, `analysis.foreignFlow`, `report.headline`, `report.summary`, `report.evidence`, dan `report.watchNext` tetap tersedia dengan tipe lama. Chart dan landing page tidak berubah.

## Aturan

- Harga: 10 sesi, rentang penutupan <= 5%, perubahan awal-akhir absolut <= 2% (aturan lama).
- Bagian bawah: posisi penutupan terakhir <= 30% dalam rentang 10 sesi. Harga konstan tetap berposisi 50% (aturan lama).
- Foreign buying: >= 3 sesi net buy dan total arus asing positif dalam 5 sesi (aturan lama).
- `candidate`: 3/3; `unconfirmed`: 1–2/3; `not_matching`: 0/3. `insufficient_data` didahulukan jika kriteria harga atau flow belum dapat dinilai. Kriteria tanpa data memiliki `met: null`, bukan `false`.
- Volume: rata-rata 5 sesi terakhir dibanding 5 sebelumnya; `ratio = recentAverage / previousAverage`, `changePercent = (ratio - 1) * 100`. Baseline nol menghasilkan rasio dan persentase `null`. Volume hilang/tidak valid tidak mengubah skor kandidat. Volume bukan bukti otomatis akumulasi.
- Sesi duplikat tidak memenuhi jumlah sesi. Angka tidak valid menghasilkan status data kurang pada komponen terkait. Periode adalah sesi yang tersedia, bukan 10 hari kalender. Library tidak mendeteksi sesi perdagangan yang hilang; route lama memasok irisan tanggal harga dan flow.
- Berita, corporate action, fundamental, dan sektor selalu `belum diperiksa` pada sesi ini. Tidak ada kesimpulan sebab harga, katalis, manipulasi terbukti, atau probabilitas cuan.

## Verifikasi offline

`npx tsc --noEmit`

`node testing/session1.cjs`

`node testing/session1.cjs --example` menampilkan JSON respons lengkap dari fixture sintetis TEST (bukan observasi BBCA). Skrip memblokir fetch dan tidak mengimpor route. Tidak ditemukan fixture BBCA yang sudah tersedia; tidak mengambil penggantinya dari jaringan.

## Kontrak tambahan

`analysis.periods` menyimpan tanggal awal/akhir dan jumlah sesi harga/foreign flow. `analysis.volume` menyimpan kedua periode, rata-rata, rasio, perubahan persen, status ketersediaan, dan `role: context_only`. `analysis.investigation` menyimpan nama, status, jumlah kriteria, serta aturan dan hasil tiap kriteria.

`report.supportingEvidence` dan `report.contradictingEvidence` berisi kriteria terpenuhi/tidak terpenuhi beserta periode, angka, dan aturan. Kriteria tanpa data masuk `report.signal.investigate` sebagai belum dapat dinilai, bukan bukti bertentangan. `report.missingChecks` mencatat empat sumber belum diperiksa. `report.signal` memuat `spot`, `investigate`, `gauge`, `narrative`, `assess`, dan `lookAhead`. Status dan jumlah kriteria juga muncul di headline/summary agar UI lama dapat menampilkannya.
