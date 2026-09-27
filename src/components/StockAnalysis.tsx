"use client";
import { type FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { PriceChart } from "@/components/PriceChart";
import { SignalBrand, InvestigationStatus, criterionLabels } from "./Workspace";
import type { AnalysisResponse } from "@/lib/stock-analysis";
import { criterionFact } from "./investigation-display";
import { chartNumber } from "@/lib/chart-data";

async function fetchAnalysis(symbol: string): Promise<AnalysisResponse> {
    const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Analisis gagal dimuat.");
    return data;
}
const conclusions = {
    candidate: "Seluruh kriteria pantauan terpenuhi; akumulasi belum terkonfirmasi.",
    unconfirmed: "Sebagian kriteria terpenuhi; pola masih perlu diperiksa.",
    not_matching: "Pola belum cocok dengan kriteria Sideways Accumulation Watch.",
    insufficient_data: "Data belum cukup untuk menilai seluruh kriteria investigasi.",
};
function reportSummary(result: AnalysisResponse) {
    const { price, foreignFlow } = result.analysis;
    const priceText = { sideways: "relatif mendatar", rising: "cenderung naik", falling: "cenderung turun", wide_range: "bergerak dalam rentang lebar", insufficient_data: "belum cukup untuk dinilai" }[price.state];
    const flowText = { buying_pattern: "menunjukkan pola beli asing", selling_pattern: "condong ke penjualan bersih", mixed: "belum menunjukkan arah konsisten", insufficient_data: "belum cukup untuk dinilai" }[foreignFlow.state];
    return `Penutupan ${priceText} dalam ${price.sessions} sesi. Arus asing ${foreignFlow.sessions} sesi ${flowText}.`;
}
function reportStages(result: AnalysisResponse) {
    const { price, foreignFlow, periods, volume, investigation } = result.analysis;
    const unresolved = investigation.criteria.filter(item => item.met !== true);
    return [
        { title: "Spot", content: `Pengamatan harga ${periods.price.startDate ?? "belum tersedia"}–${periods.price.endDate ?? "belum tersedia"} (${price.sessions} sesi); arus asing ${foreignFlow.sessions} sesi.` },
        { title: "Investigate", content: unresolved.length ? `Fokus pemeriksaan: ${unresolved.map(item => `${criterionLabels[item.id]} ${item.met === null ? "belum dapat dinilai" : "belum terpenuhi"}`).join("; ")}.` : "Ketiga kriteria terpenuhi. Periksa keberlanjutan pola pada sesi berikutnya." },
        { title: "Gauge", content: volume.state === "available" ? `Rata-rata volume 5 sesi ${chartNumber(volume.recentAverage)}, sebelumnya ${chartNumber(volume.previousAverage)}; rasio ${chartNumber(volume.ratio)}. Volume hanya konteks.` : "Volume belum cukup untuk perbandingan 5 lawan 5 sesi; bukan kriteria kandidat." },
        { title: "Narrative", content: "Berita, corporate action, fundamental, dan sektor belum diperiksa. Penyebab harga dan katalis belum dapat disimpulkan." },
        { title: "Assess", content: `${conclusions[investigation.status]} Status ini bukan probabilitas keuntungan atau instruksi transaksi.` },
        { title: "Look Ahead", content: result.report.signal.lookAhead },
    ];
}
export function StockAnalysis({ symbol, initialResult = null, loadAnalysis = fetchAnalysis }: {
    symbol: string; initialResult?: AnalysisResponse | null; loadAnalysis?: (symbol: string) => Promise<AnalysisResponse>;
}) {
    const [result, setResult] = useState<AnalysisResponse | null>(initialResult);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const busy = useRef(false);
    const observations = useRef<HTMLDetailsElement>(null);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy.current) return;
        busy.current = true; setError(""); setResult(null); setLoading(true);
        try { setResult(await loadAnalysis(symbol)); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Terjadi kesalahan."); }
        finally { busy.current = false; setLoading(false); }
    }
    const watch = result?.analysis.investigation;
    return <main className="signal-workspace">
        <header className="workspace-topbar detail-topbar"><SignalBrand /><nav aria-label="Navigasi utama"><Link href="/" prefetch={false}>← Beranda SIGNAL</Link><span className="topbar-context">Investigasi saham</span></nav></header>
        <div className="workspace-body">
            <div className="detail-heading"><div><h1>Analisis {symbol}</h1><p className="data-date">{result ? `Data hingga ${result.as_of_date ?? "tidak tersedia"}` : "Data belum dimuat otomatis. Tekan Analisis untuk memuat data."}</p></div>
                <form onSubmit={handleSubmit} aria-busy={loading}><button type="submit" disabled={loading} className="primary-button">{loading ? "Menganalisis..." : "Analisis"}</button></form>
            </div>
            {loading && <p role="status" className="notice">Menyiapkan harga harian dan arus asing…</p>}
            {error && <p role="alert" className="notice notice-error">{error}</p>}
            {!result && !loading && <section className="workspace-panel designed-empty" style={{ marginTop: 24 }}><span className="empty-symbol" aria-hidden="true">⌁</span><h2>Mulai investigasi {symbol}</h2><p>Gunakan tombol Analisis untuk melihat candle harian, konteks volume, arus asing, dan penilaian tiga kriteria.</p><span className="empty-note">Tanggal hasil mengikuti sesi terakhir yang tersedia.</span></section>}
            {result && watch && <>
                <div className="analysis-summary"><div className="summary-status"><h2><span className="sr-only">Status </span><InvestigationStatus status={watch.status} /></h2><p><strong>{watch.criteriaMet}/{watch.criteriaTotal}</strong> <span className="metric-label">kriteria terpenuhi</span></p></div><p className="summary-conclusion">{conclusions[watch.status]}</p><nav aria-label="Bagian analisis" className="section-links"><a href="#price-chart">Lihat chart</a><a href="#evidence" onClick={() => { if (observations.current) observations.current.open = true; }}>Periksa bukti</a><a href="#signal-report">Laporan SIGNAL</a></nav></div>
                <div className="detail-grid">
                    <section id="price-chart" tabIndex={-1} className="workspace-panel stock-chart-panel"><PriceChart records={result.records} /></section>
                    <section aria-labelledby="criteria-title" className="workspace-panel evidence-panel">
                        <p className="eyebrow">SIDEWAYS ACCUMULATION WATCH</p><h3 id="criteria-title">Tiga kriteria</h3>
                        <div className="criteria-list">{watch.criteria.map(criterion => { const fact = criterionFact(result.analysis, criterion); return <div key={criterion.id} className="criterion-row"><div><strong>{criterionLabels[criterion.id]}</strong><span className={criterion.met === true ? "positive" : criterion.met === false ? "negative" : ""}>{criterion.met === true ? "✓ Terpenuhi" : criterion.met === false ? "× Belum terpenuhi" : "○ Belum dinilai"}</span></div><strong className="criterion-metric">{fact.metric}</strong><p>{fact.detail}</p></div>; })}</div>
                        <a className="evidence-jump" href="#evidence" onClick={() => { if (observations.current) observations.current.open = true; }}>Periksa angka & aturan lengkap ↓</a>
                    </section>
                </div>
                <section id="signal-report" tabIndex={-1} className="workspace-panel signal-report"><h3>Laporan SIGNAL</h3><p className="report-intro">{reportSummary(result)}</p>
                    <dl className="report-stages">{reportStages(result).map(({ title, content }, i) => <div key={title} className="report-stage"><dt><span>{String(i + 1).padStart(2, "0")}</span>{title}</dt><dd>{Array.isArray(content) ? <ul>{content.map(item => <li key={item}>{item}</li>)}</ul> : content}</dd></div>)}</dl>
                </section>
                <section id="evidence" tabIndex={-1} className="observations-section"><details ref={observations} className="workspace-panel observations"><summary>Metodologi dan seluruh pengamatan</summary><div className="observations-content"><h3>{result.report.headline}</h3><p>{result.record_count} sesi berpasangan harga/flow. Aturan berikut berasal dari hasil analisis:</p><ul>{watch.criteria.map(item => <li key={item.id}>{criterionLabels[item.id]}: {item.rule}</li>)}</ul>
                    {[{ title: "Bukti mendukung", items: result.report.supportingEvidence, tone: "positive" }, { title: "Bukti bertentangan", items: result.report.contradictingEvidence, tone: "negative" }].map(({ title, items, tone }) => <div className="evidence-group" key={title}><h4 className={tone}>{title}</h4>{items.length ? <ul>{items.map(item => <li key={item}>{item}</li>)}</ul> : <p>Tidak ada bukti pada kategori ini yang dapat dinilai; bukan konfirmasi akumulasi.</p>}</div>)}
                    <h3>Seluruh pengamatan dan isi laporan asli</h3><p>Kalimat yang identik ditampilkan satu kali.</p><ul>{[...new Set([result.report.headline, result.report.summary, ...result.report.evidence, ...Object.values(result.report.signal).flat(), ...result.report.watchNext])].filter(item => item !== result.report.headline && !result.report.supportingEvidence.includes(item) && !result.report.contradictingEvidence.includes(item)).map(item => <li key={item}>{item}</li>)}</ul></div></details></section>
                <footer className="workspace-footer"><p>Status berasal dari aturan investigasi, bukan instruksi transaksi.</p><span>Penutupan harian · {symbol}</span></footer>
            </>}
            <details className="methodology"><summary>Metodologi & pemuatan data</summary><div><p>Pemuatan hanya melalui tombol Analisis: maksimal 2 permintaan Sectors saat cache kosong. Cache harian 24 jam tidak menjamin nol kredit setiap deploy/instance. Data historis mengikuti tanggal sumber, termasuk pada akhir pekan.</p><p>Harga 10 sesi dan arus asing 5 sesi menentukan investigasi; volume hanya konteks. Berita, corporate action, fundamental, dan sektor belum diperiksa.</p></div></details>
        </div>
    </main>;
}
