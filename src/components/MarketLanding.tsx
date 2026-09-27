"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { MARKET_CONFIG, marketRequestBudget, marketCreditEstimate, normalizeTicker, validTicker } from "@/lib/market-config";
import { isWatchCandidate, type MarketOverview, type StockOverview } from "@/lib/market-overview";
import { chartNumber } from "@/lib/chart-data";
import { IndexChart } from "./IndexChart";
import { SignalBrand, InvestigationStatus } from "./Workspace";
import { shortlistFacts } from "./investigation-display";

async function fetchOverview(): Promise<MarketOverview> {
    const response = await fetch("/api/market", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Kondisi pasar gagal dimuat.");
    return data;
}
function StockCard({ stock, rank }: { stock: StockOverview; rank: number }) {
    const watch = stock.analysis.investigation;
    const facts = shortlistFacts(stock.analysis);
    return <article className="watch-card">
        <div className="watch-comparison"><div className="watch-identity"><div className="watch-heading"><span className="rank-number" aria-label={`Urutan ${rank}`}>{String(rank).padStart(2, "0")}</span><h3><Link href={`/analyze/${stock.symbol}`} prefetch={false}>{stock.symbol}</Link></h3><strong className="criteria-fraction" aria-label={`${watch.criteriaMet}/${watch.criteriaTotal} kriteria terpenuhi`}>{watch.criteriaMet}/{watch.criteriaTotal}</strong></div><InvestigationStatus status={watch.status} /></div>
        <p className="watch-support"><span className="comparison-mobile-label positive">Mendukung</span>{facts.support}</p><p className="watch-counter"><span className="comparison-mobile-label">Belum terkonfirmasi</span>{facts.counter}</p></div>
        <div className="watch-footer"><span>Data hingga {stock.as_of_date ?? "tidak tersedia"}</span><Link href={`/analyze/${stock.symbol}`} prefetch={false}>Buka analisis {stock.symbol} →</Link></div>
        <details className="card-evidence"><summary>Bukti lengkap</summary><p>{stock.record_count} sesi berpasangan harga/flow. Tidak ada bukti bertentangan bukan konfirmasi akumulasi.</p>
            <h4>Bukti mendukung</h4><ul>{stock.report.supportingEvidence.map(item => <li key={item}>{item}</li>)}</ul>{!stock.report.supportingEvidence.length && <p>Belum ada kriteria terpenuhi dari data yang tersedia.</p>}
            <h4>Bukti bertentangan</h4><ul>{stock.report.contradictingEvidence.map(item => <li key={item}>{item}</li>)}</ul>{!stock.report.contradictingEvidence.length && <p>Tidak ada kriteria gagal yang dapat dinilai; bukan konfirmasi akumulasi.</p>}
            {watch.status === "insufficient_data" && <p>Kriteria tanpa data belum dapat dinilai.</p>}<p>Berita, corporate action, fundamental, dan sektor belum diperiksa.</p>
        </details>
    </article>;
}
export function MarketLanding({ initialOverview = null, loadOverview = fetchOverview, navigate = (href: string) => window.location.assign(href) }: {
    initialOverview?: MarketOverview | null; loadOverview?: () => Promise<MarketOverview>; navigate?: (href: string) => void;
}) {
    const [overview, setOverview] = useState(initialOverview);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [ticker, setTicker] = useState("");
    const [searchError, setSearchError] = useState("");
    const busy = useRef(false);
    async function load() {
        if (busy.current) return;
        busy.current = true; setLoading(true); setError("");
        try { setOverview(await loadOverview()); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Kondisi pasar gagal dimuat."); }
        finally { busy.current = false; setLoading(false); }
    }
    function search(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const symbol = normalizeTicker(ticker);
        if (!validTicker(symbol)) { setSearchError("Gunakan ticker IDX empat huruf, misalnya BBCA."); return; }
        setSearchError(""); navigate(`/analyze/${symbol}`);
    }
    const candidates = overview?.stocks.filter(isWatchCandidate) ?? [];
    const others = overview?.stocks.filter(stock => !isWatchCandidate(stock)) ?? [];
    const index = overview?.ihsg;
    return <main className="signal-workspace">
        <header className="workspace-topbar"><SignalBrand /><span className="topbar-context">Gambaran pasar</span>
            <form onSubmit={search} className="ticker-search" aria-label="Pencarian analisis saham">
                <label htmlFor="ticker">Ticker IDX</label><input id="ticker" value={ticker} onChange={event => setTicker(event.target.value)} maxLength={4} placeholder="Contoh: BBCA" autoComplete="off" aria-invalid={!!searchError} aria-describedby={searchError ? "ticker-error" : "ticker-help"} />
                <button type="submit" className="secondary-button">Buka analisis <span aria-hidden="true">↗</span></button><span id="ticker-help" className="sr-only">Buka detail, lalu tekan Analisis untuk memuat data.</span>
                {searchError && <p id="ticker-error" role="alert" className="search-error">{searchError}</p>}
            </form>
        </header>
        <div className="workspace-body">
            <div className="workspace-intro"><div><h1>Pasar dalam konteks.</h1><p className={overview ? "sr-only" : ""}>Temukan pola. Pilih yang perlu dipantau melalui harga, volume, dan arus asing.</p></div><button type="button" onClick={load} disabled={loading} className="primary-button">{loading ? "Memuat kondisi pasar…" : "Muat kondisi pasar"}<span aria-hidden="true">↻</span></button></div>
            <div className="load-state" aria-live="polite">{loading && <p role="status">Sedang memuat IHSG dan universe terbatas…</p>}{overview && <p role="status">Hasil pemuatan: {overview.status}. {overview.stocks.length}/{overview.universe.length} saham berhasil diproses.</p>}</div>
            {error && <p role="alert" className="notice notice-error">{error}{overview ? " Hasil sebelumnya tetap ditampilkan dengan tanggal sumbernya." : " Coba lagi melalui tombol pemuatan."}</p>}
            {!!overview?.failures.length && <div role="alert" className="notice notice-warning"><p>Sebagian data tidak tersedia:</p><ul>{overview.failures.map(item => <li key={item.symbol}>{item.symbol}: {item.message}</li>)}</ul></div>}
            <div className="market-grid" aria-busy={loading}>
                <section aria-label="Konteks pasar IHSG" className="workspace-panel index-panel">
                    <div className="index-overview"><div className="panel-heading"><div><h2>IHSG</h2><p className="sr-only">Indeks Harga Saham Gabungan</p></div></div>
                    {!!index?.records.length && <div className="index-metrics"><div><span className="metric-label">Penutupan terakhir</span><p className="index-price">{chartNumber(index.latestClose)}<small>poin</small></p></div><div className={`index-change ${index.condition === "naik" ? "positive" : index.condition === "turun" ? "negative" : ""}`}><strong>{index.condition === "naik" ? "↑ " : index.condition === "turun" ? "↓ " : ""}{index.changePercent === null ? "—" : `${chartNumber(index.changePercent)}%`}</strong><span>{index.condition === "insufficient_data" ? "Belum cukup sesi pembanding" : `${index.condition} ${chartNumber(index.changePoints)} poin`}</span></div></div>}
                    </div><div className="index-caption"><p className="index-period">Penutupan harian{index?.records.length ? ` · ${index.records.length} sesi` : ""}</p>{!!index?.records.length && <p className="data-date">Data hingga {index.asOfDate}</p>}</div>
                    {!overview ? <div className="designed-empty"><span aria-hidden="true" className="empty-symbol">⌁</span><h3>Konteks pasar dimulai di sini.</h3><p>Muat penutupan IHSG untuk melihat arah sesi terakhir dan rentang pengamatan harian.</p><span className="empty-note">Data dimuat hanya saat Anda menekan tombol.</span></div>
                    : !index?.records.length ? <div className="designed-empty"><span className="empty-symbol" aria-hidden="true">—</span><h3>IHSG belum tersedia</h3><p>Data IHSG tidak tersedia pada pemuatan ini.</p></div> : <>
                        <IndexChart records={index.records} />
                    </>}
                </section>
                <section aria-labelledby="candidates-title" className="workspace-panel shortlist-panel">
                    <div className="panel-heading"><div><p className="eyebrow">SIDEWAYS ACCUMULATION WATCH</p><h2 id="candidates-title">Kandidat untuk Dipantau</h2></div><span className="count-tag">{overview ? candidates.length : "—"}</span></div>
                    <p className="universe-note">Universe {MARKET_CONFIG.symbols.length}: {MARKET_CONFIG.symbols.join(", ")}. Kriteria terbanyak, lalu ticker A–Z.</p>
                    {!overview ? <div className="designed-empty"><span aria-hidden="true" className="empty-symbol">◎</span><h3>Daftar belum dimuat.</h3><p>Tiga kriteria menghubungkan harga sideways, posisi dalam rentang, dan pola beli asing.</p><div className="unloaded-universe">{MARKET_CONFIG.symbols.map(symbol => <span key={symbol}>{symbol}</span>)}</div></div>
                    : !candidates.length ? <div className="designed-empty"><h3>Tidak ada kandidat untuk dipantau</h3><p>Belum ada pola yang masuk daftar pantauan dari data yang berhasil dinilai. Data gagal/kurang bukan bukti bahwa pola tidak ada.</p></div>
                    : <div className="watch-list"><div className="comparison-head" aria-hidden="true"><span>Saham / kriteria</span><span>Mendukung</span><span>Belum terkonfirmasi</span></div>{candidates.map((stock, i) => <StockCard key={stock.symbol} stock={stock} rank={i + 1} />)}</div>}
                    {!!others.length && <details className="other-results"><summary>Hasil universe lainnya ({others.length} saham)</summary>{others.map((stock, i) => <StockCard key={stock.symbol} stock={stock} rank={i + 1} />)}</details>}
                    <p className="panel-footnote">Daftar investigasi, bukan prediksi return. Kandidat belum membuktikan akumulasi.</p>
                </section>
            </div>
            <footer className="workspace-footer"><p>Data historis mengikuti tanggal sumber, termasuk pada akhir pekan.</p><span>Harga · Volume · Arus asing</span></footer>
            <details className="methodology"><summary>Metodologi & pemuatan data</summary><div><p>{MARKET_CONFIG.rankingMethod} Tanggal antar saham dapat berbeda. Setiap row menyorot satu kriteria pendukung dan satu hal yang belum terpenuhi; seluruh bukti tersedia di Bukti lengkap.</p>{index && <p>IHSG: {index.omittedRows} baris invalid/duplikat diabaikan. Perubahan membandingkan penutupan {index.asOfDate ?? "tidak tersedia"} dan {index.previousDate ?? "tidak tersedia"}.</p>}<p>Pemuatan manual, maksimal {marketRequestBudget()} permintaan Sectors saat cache kosong; estimasi {marketCreditEstimate()} kredit. Cache server 24 jam, tanpa jaminan nol kredit setiap deploy/instance.</p><p>Volume hanya konteks. Berita, corporate action, fundamental, dan sektor belum diperiksa.</p></div></details>
        </div>
    </main>;
}
