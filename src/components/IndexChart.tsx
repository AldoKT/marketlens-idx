"use client";
import { useEffect, useId, useRef, useState } from "react";
import { chartNumber } from "@/lib/chart-data";
import type { IndexRecord } from "@/lib/market-overview";

const shortDate = (date: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
export function IndexChart({ records }: { records: IndexRecord[] }) {
    const id = useId();
    const container = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(760);
    const [selectedDate, setSelectedDate] = useState("");
    useEffect(() => {
        if (!container.current) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
        observer.observe(container.current);
        return () => observer.disconnect();
    }, []);
    if (!records.length) return <p>Penutupan IHSG belum tersedia.</p>;
    const selected = Math.max(0, records.findIndex(row => row.date === selectedDate));
    const active = selectedDate ? selected : records.length - 1;
    const row = records[active];
    const height = width < 480 ? 280 : 350;
    const left = 68, right = 16, top = 18, bottom = 36;
    const values = records.map(record => record.close);
    const low = Math.min(...values), high = Math.max(...values);
    const rawStep = Math.max((high - low) / 4, Math.abs(low) * 0.0005, 0.01);
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const step = [1, 2, 5, 10].find(value => value * magnitude >= rawStep)! * magnitude;
    const min = Math.max(0, Math.floor((low - step * 0.25) / step) * step);
    const max = Math.ceil((high + step * 0.25) / step) * step;
    const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
    const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
    const x = (i: number) => records.length === 1 ? (left + width - right) / 2 : left + i / (records.length - 1) * (width - left - right);
    const tickCount = width < 480 ? 3 : 5;
    const dateTicks = [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round(i / (tickCount - 1) * (records.length - 1))))];
    const points = records.map((record, i) => `${x(i)},${y(record.close)}`).join(" ");
    return <div ref={container} className="index-chart">
        <div className="index-readout" role="status"><span>{row.date}</span><strong>{chartNumber(row.close)} <small>poin</small></strong><span>Penutupan sesi</span></div>
        <div tabIndex={0} role="group" aria-label="Jelajahi penutupan IHSG" aria-describedby={`${id}-help`}
            className="index-chart-focus" onKeyDown={event => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? 0 : event.key === "End" ? records.length - 1 : Math.max(0, Math.min(records.length - 1, active + (event.key === "ArrowLeft" ? -1 : 1)));
                setSelectedDate(records[next].date);
            }}>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`} onPointerMove={event => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const pixel = (event.clientX - bounds.left) / bounds.width * width;
                const index = Math.max(0, Math.min(records.length - 1, Math.round((pixel - left) / (width - left - right) * (records.length - 1))));
                setSelectedDate(records[index].date);
            }}>
                <title id={`${id}-title`}>IHSG — penutupan harian</title><desc id={`${id}-desc`}>{records.length} sesi, {records[0].date} sampai {records.at(-1)!.date}. Indeks awal {chartNumber(records[0].close)}, terakhir {chartNumber(records.at(-1)!.close)} poin.</desc>
                <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#49d6e8" stopOpacity="0.19" /><stop offset="100%" stopColor="#49d6e8" stopOpacity="0.01" /></linearGradient></defs>
                {ticks.map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#28333e" strokeDasharray="3 5" /><text x={left - 12} y={y(value) + 5} fill="#aebdcd" fontSize={13} textAnchor="end">{chartNumber(value)}</text></g>)}
                {dateTicks.map(i => <g key={i}><line x1={x(i)} x2={x(i)} y1={top} y2={height - bottom} stroke="#202b35" /><text x={x(i)} y={height - 8} fill="#aebdcd" fontSize={13} textAnchor={i === 0 ? "start" : i === records.length - 1 ? "end" : "middle"}>{shortDate(records[i].date)}</text></g>)}
                <polygon points={`${left},${height - bottom} ${points} ${x(records.length - 1)},${height - bottom}`} fill={`url(#${id}-fill)`} />
                <polyline points={points} fill="none" stroke="#49d6e8" strokeWidth={2.5} strokeLinejoin="round" />
                <line x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} stroke="#90a7bb" strokeDasharray="4 4" />
                <circle cx={x(active)} cy={y(row.close)} r={5} fill="#49d6e8" stroke="#e3fbff" strokeWidth={2} />
            </svg>
        </div>
        <details className="chart-help-panel"><summary>Bantuan grafik</summary><p id={`${id}-help`} className="chart-help">Arahkan pointer atau fokus grafik lalu gunakan ←/→, Home/End untuk rincian sesi. Sumbu Y mengikuti rentang penutupan yang tersedia.</p></details>
        <details className="chart-table"><summary>Tabel penutupan IHSG ({records.length} sesi)</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Tabel penutupan IHSG dapat digulir"><table><caption>Tanggal dan nilai penutupan indeks dalam poin</caption><thead><tr><th scope="col">Tanggal</th><th scope="col">Penutupan (poin)</th></tr></thead><tbody>{records.map(record => <tr key={record.date}><th scope="row">{record.date}</th><td>{chartNumber(record.close)}</td></tr>)}</tbody></table></div></details>
    </div>;
}
