import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { PriceChart } from "../src/components/PriceChart";
import { chartFixture, invalidChartFixture } from "./fixtures/chart";

// Isolated offline fixture page. No API route, Next server, or env loader.
window.fetch = () => Promise.reject(new Error("Network forbidden in offline chart preview"));
function Preview() {
    const [mode, setMode] = useState("full");
    const [mounted, setMounted] = useState(true);
    const records = mode === "empty" ? [] : mode === "invalid" ? invalidChartFixture
        : mode === "short" ? chartFixture.slice(0, 4) : chartFixture;
    return <main className="mx-auto max-w-3xl space-y-5 bg-slate-900 p-6 text-slate-100">
        <h1 className="text-xl">Fixture TEST — Sesi 2 offline (bukan BBCA)</h1>
        <div className="flex flex-wrap gap-3">
            {[["full", "30 sesi"], ["short", "4 sesi"], ["invalid", "Data invalid"], ["empty", "Kosong"]].map(([value, label]) =>
                <button key={value} className="rounded border border-slate-400 px-3 py-2 focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => setMode(value)}>{label}</button>)}
            <button className="rounded border border-slate-400 px-3 py-2" onClick={() => setMounted(value => !value)}>Mount/unmount</button>
        </div>
        {mounted && <PriceChart records={records} />}
    </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Preview /></StrictMode>);
