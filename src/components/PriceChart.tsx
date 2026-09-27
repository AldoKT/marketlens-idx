"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import { buildChartData, chartNumber, chartSummary, movingAverageSegments, sessionDirection, type ChartRecord } from "@/lib/chart-data";

export function PriceChart({ records }: { records: ChartRecord[] }) {
    const model = useMemo(() => buildChartData(records), [records]);
    const container = useRef<HTMLDivElement>(null);
    const api = useRef<{ chart: IChartApi; candle: ISeriesApi<"Candlestick"> } | null>(null);
    const [selectedDate, setSelectedDate] = useState("");
    const [failed, setFailed] = useState(false);
    const id = useId();
    const { sessions } = model;
    const selected = sessions.find(row => row.date === selectedDate) ?? sessions.at(-1);

    useEffect(() => {
        const element = container.current;
        if (!element || !sessions.length) return;
        let disposed = false;
        let cleanup: (() => void) | undefined;
        // Browser-only import with cleanup for Next SSR and React Strict Mode.
        void import("lightweight-charts").then(lwc => {
            if (disposed) return;
            const chart = lwc.createChart(element, {
                autoSize: true,
                height: element.clientHeight || 400,
                layout: { background: { type: lwc.ColorType.Solid, color: "#111820" }, textColor: "#b9cbdc", fontSize: 13, attributionLogo: true },
                grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#283540" } },
                rightPriceScale: { borderColor: "#64748b" },
                timeScale: { borderColor: "#64748b", timeVisible: false, minBarSpacing: 4 },
                crosshair: { mode: lwc.CrosshairMode.Normal },
                localization: { locale: "id-ID", dateFormat: "dd MMM yyyy", priceFormatter: (value: number) => chartNumber(value) },
            });
            // Also release the chart if a subsequent series setup throws.
            cleanup = () => { api.current = null; chart.remove(); };
            const candle = chart.addSeries(lwc.CandlestickSeries, {
                upColor: "#111820", downColor: "#fb7185", borderUpColor: "#5eead4", borderDownColor: "#fb7185",
                wickUpColor: "#5eead4", wickDownColor: "#fb7185", borderVisible: true,
                priceFormat: { type: "price", precision: 2, minMove: 0.01 },
            });
            for (const key of ["ma5", "ma20"] as const) {
                for (const segment of movingAverageSegments(sessions, key)) {
                    const line = chart.addSeries(lwc.LineSeries, {
                        color: key === "ma5" ? "#fcd34d" : "#c4b5fd", lineWidth: 2,
                        lineStyle: key === "ma5" ? lwc.LineStyle.Solid : lwc.LineStyle.Dashed,
                        title: key === "ma5" ? "MA 5" : "MA 20", lastValueVisible: false, priceLineVisible: false,
                        pointMarkersVisible: segment.length === 1,
                    });
                    line.setData(segment);
                }
            }
            const volume = chart.addSeries(lwc.HistogramSeries, { color: "#94a3b8", priceFormat: { type: "volume" }, title: "Volume", priceLineVisible: false }, 1);
            candle.setData(sessions.map(row => row.candle ? { time: row.date, ...row.candle } : { time: row.date }));
            volume.setData(sessions.map(row => row.volume === null ? { time: row.date } : { time: row.date, value: row.volume }));
            chart.panes()[1].setHeight(110);
            chart.timeScale().fitContent();
            const onCrosshair = (event: MouseEventParams<Time>) => {
                if (!event.time || !event.point) return;
                const date = typeof event.time === "string" ? event.time : typeof event.time === "object"
                    ? `${event.time.year}-${String(event.time.month).padStart(2, "0")}-${String(event.time.day).padStart(2, "0")}` : "";
                if (sessions.some(row => row.date === date)) setSelectedDate(date);
            };
            chart.subscribeCrosshairMove(onCrosshair);
            api.current = { chart, candle };
            cleanup = () => {
                api.current = null;
                chart.unsubscribeCrosshairMove(onCrosshair);
                chart.remove();
            };
            setFailed(false);
        }).catch(() => { if (!disposed) setFailed(true); });
        return () => { disposed = true; cleanup?.(); };
    }, [sessions]);

    function chooseDate(date: string) {
        setSelectedDate(date);
        const row = sessions.find(session => session.date === date);
        const current = api.current;
        if (!row || !current) return;
        if (row.candle) current.chart.setCrosshairPosition(row.candle.close, date, current.candle);
        else current.chart.clearCrosshairPosition();
        const index = sessions.indexOf(row);
        const range = current.chart.timeScale().getVisibleLogicalRange();
        if (range && (index < range.from || index > range.to)) {
            const half = Math.max(5, (range.to - range.from) / 2);
            current.chart.timeScale().setVisibleLogicalRange({ from: index - half, to: index + half });
        }
    }

    return (
        <div className="price-chart min-w-0 space-y-4">
            <div className="chart-heading"><h3 className="text-lg font-semibold">Harga harian · candle 1D</h3>{sessions.length > 0 && <div className="session-select"><label htmlFor={`${id}-date`} className="sr-only">Tanggal sesi</label><select id={`${id}-date`} value={selected?.date ?? ""} onChange={event => chooseDate(event.target.value)}>{sessions.map(row => <option key={row.date} value={row.date}>{row.date}</option>)}</select></div>}</div>
            <p id={`${id}-summary`} className="sr-only">{chartSummary(sessions)}</p>
            <ul className="chart-legend flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200" aria-label="Legenda grafik">
                <li><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 border-2 border-teal-200" />Naik: badan kosong</li>
                <li><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 bg-rose-400" />Turun: badan penuh</li>
                <li className="text-amber-200">━ MA 5: garis utuh</li>
                <li className="text-violet-200">┄ MA 20: garis putus-putus</li>
                <li>▥ Volume: panel bawah</li>
            </ul>
            {sessions.length > 0 && <>
                <p id={`${id}-help`} className="sr-only">Geser crosshair untuk rincian. Dengan keyboard: fokus grafik lalu gunakan ←/→, Home/End, atau pilih tanggal sesi. Scroll/pinch untuk zoom.</p>
                <div ref={container} role="group" aria-label="Grafik candlestick, MA 5, MA 20, dan volume harian"
                    aria-describedby={`${id}-summary ${id}-help`} tabIndex={0}
                    className="candle-canvas h-[420px] w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    onKeyDown={event => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const index = selected ? sessions.indexOf(selected) : sessions.length - 1;
                        const next = event.key === "Home" ? 0 : event.key === "End" ? sessions.length - 1
                            : Math.max(0, Math.min(sessions.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
                        chooseDate(sessions[next].date);
                    }} />
                {failed && <p role="alert" className="text-rose-200">Grafik tidak dapat dimuat. Ringkasan, rincian sesi, dan tabel tetap tersedia.</p>}
                {selected && <div role="status" className="session-readout"><span className="sr-only">{selected.date} · {sessionDirection(selected)}. Harga dalam rupiah.</span><dl className="ohlcv-strip">{[
                    { label: "O", name: "Open", value: selected.candle?.open ?? null }, { label: "H", name: "High", value: selected.candle?.high ?? null },
                    { label: "L", name: "Low", value: selected.candle?.low ?? null }, { label: "C", name: "Close", value: selected.close },
                    { label: "Volume", name: "Volume", value: selected.volume }, { label: "MA5", name: "MA 5", value: selected.ma5 }, { label: "MA20", name: "MA 20", value: selected.ma20 },
                ].map(item => <div key={item.name}><dt><abbr title={item.name}>{item.label}</abbr></dt><dd>{chartNumber(item.value)}</dd></div>)}</dl></div>}
                <details className="chart-data-table text-sm text-slate-200">
                    <summary className="cursor-pointer rounded py-2 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Tabel data grafik ({sessions.length} sesi)</summary>
                    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel harga harian dapat digulir">
                        <table className="w-full text-right whitespace-nowrap">
                            <caption className="py-2 text-left">Data per sesi; nilai tidak valid ditandai “tidak tersedia”.</caption>
                            <thead><tr>{["Tanggal", "Arah", "Open", "High", "Low", "Close", "Volume", "MA 5", "MA 20"].map(label => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr></thead>
                            <tbody>{sessions.map(row => <tr key={row.date} className="border-t border-slate-700">
                                <th scope="row" className="px-3 py-2 font-normal">{row.date}</th><td className="px-3 py-2">{sessionDirection(row)}</td>
                                {[row.candle?.open ?? null, row.candle?.high ?? null, row.candle?.low ?? null, row.close, row.volume, row.ma5, row.ma20].map((value, index) => <td key={index} className="px-3 py-2">{chartNumber(value)}</td>)}
                            </tr>)}</tbody>
                        </table>
                    </div>
                </details>
            </>}
            <details className="chart-help-panel"><summary>Ringkasan & bantuan grafik</summary><p>{chartSummary(sessions)}</p><p>Fokus grafik lalu gunakan ←/→, Home/End, atau pilih tanggal sesi. Scroll/pinch untuk zoom. Naik: badan kosong; turun: badan penuh.</p><p className="chart-quality">{model.omittedCandles} sesi tanpa candle valid; {model.omittedVolumes} sesi tanpa volume valid; {model.invalidDates} baris bertanggal tidak valid; {model.duplicateDates} tanggal duplikat dikosongkan. MA memerlukan close valid pada seluruh jendela. Volume hanya konteks, bukan bukti otomatis akumulasi.</p></details>
            <p className="chart-attribution text-xs text-slate-300">TradingView Lightweight Charts™ · Copyright © 2025 <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">TradingView, Inc.</a></p>
        </div>
    );
}
