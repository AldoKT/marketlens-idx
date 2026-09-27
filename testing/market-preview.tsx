import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MarketLanding } from "../src/components/MarketLanding";
import { StockAnalysis } from "../src/components/StockAnalysis";
import { loadMarketOverview } from "../src/lib/market-overview";
import { marketFixtureSource, stockFixture } from "./fixtures/market";

window.fetch = () => Promise.reject(new Error("Network forbidden in offline market preview"));
const symbolFromPath = () => /^\/analyze\/([A-Z]{4})$/.exec(window.location.pathname)?.[1] ?? "";
const modes = [["full", "Normal + tie"], ["review", "Investigasi 1/3 sintetis"], ["partial", "BBRI gagal"], ["empty", "Tanpa kandidat"], ["short", "Data kurang"], ["index-error", "IHSG gagal"], ["error", "Semua gagal"], ["load-error", "Request landing gagal"]] as const;
const scenarioFromUrl = () => {
    const value = new URLSearchParams(window.location.search).get("scenario");
    return modes.some(([mode]) => mode === value) ? value! : "full";
};
function Preview() {
    const [mode, setMode] = useState(scenarioFromUrl);
    const [symbol, setSymbol] = useState(symbolFromPath);
    const [mounted, setMounted] = useState(true);
    useEffect(() => {
        const pop = () => { setSymbol(symbolFromPath()); setMode(scenarioFromUrl()); };
        window.addEventListener("popstate", pop);
        return () => window.removeEventListener("popstate", pop);
    }, []);
    function navigate(href: string) {
        window.history.pushState({}, "", `${href}?scenario=${mode}`);
        setSymbol(symbolFromPath());
        window.scrollTo(0, 0);
    }
    return <div onClickCapture={event => {
        const anchor = (event.target as HTMLElement).closest("a");
        const href = anchor?.getAttribute("href");
        if (href === "/" || /^\/analyze\/[A-Z]{4}$/.test(href ?? "")) {
            event.preventDefault(); event.stopPropagation(); navigate(href!);
        }
    }}>
        <div className="preview-banner">
            <p>Preview offline — seluruh angka IHSG/saham adalah fixture sintetis, bukan observasi BBCA atau pasar.</p>
            <div className="preview-controls">
                <label htmlFor="fixture-mode">Skenario</label>
                <select id="fixture-mode" value={mode} onChange={event => {
                    setMode(event.target.value);
                    window.history.replaceState({}, "", `${window.location.pathname}?scenario=${event.target.value}`);
                }} className="rounded border border-amber-300 bg-slate-950 p-2 text-white">
                    {modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button onClick={() => setMounted(value => !value)} className="rounded border border-amber-300 p-2">Mount/unmount</button>
            </div>
        </div>
        {mounted && (symbol ? <StockAnalysis key={`${mode}-${symbol}`} symbol={symbol} loadAnalysis={async ticker => {
            await new Promise(resolve => setTimeout(resolve, 250));
            if (["error", "load-error"].includes(mode)) throw new Error("Analisis fixture gagal dimuat.");
            return stockFixture(ticker, mode);
        }} /> : <MarketLanding key={mode} navigate={navigate} loadOverview={async () => {
            await new Promise(resolve => setTimeout(resolve, 250));
            if (mode === "load-error") throw new Error("Request fixture gagal dimuat.");
            return loadMarketOverview(marketFixtureSource(mode));
        }} />)}
    </div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Preview /></StrictMode>);
