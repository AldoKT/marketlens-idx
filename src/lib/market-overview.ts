import { MARKET_CONFIG, marketRequestBudget, marketCreditEstimate, validTicker } from "./market-config";
import type { AnalysisResponse } from "./stock-analysis";

export type IndexRecord = { date: string; close: number };
export type StockOverview = Omit<AnalysisResponse, "records">;
export type IndexOverview = {
    records: IndexRecord[];
    asOfDate: string | null;
    latestClose: number | null;
    previousDate: string | null;
    changePoints: number | null;
    changePercent: number | null;
    condition: "naik" | "turun" | "tetap" | "insufficient_data";
    omittedRows: number;
};
export type MarketOverview = {
    status: "complete" | "partial" | "error";
    universe: string[];
    rankingMethod: string;
    maxSectorsRequests: number;
    estimatedColdCredits: number;
    cacheTtlSeconds: number;
    ihsg: IndexOverview | null;
    stocks: StockOverview[];
    failures: { symbol: string; message: string }[];
};
export type MarketSource = {
    index: () => Promise<IndexRecord[]>;
    stock: (symbol: string) => Promise<AnalysisResponse>;
};

function validDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const time = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}
export function summarizeIndex(rows: IndexRecord[]): IndexOverview {
    const counts = new Map<string, number>();
    rows.forEach(row => counts.set(row.date, (counts.get(row.date) ?? 0) + 1));
    const records = rows.filter(row => validDate(row.date) && counts.get(row.date) === 1 && Number.isFinite(row.close) && row.close > 0)
        .map(row => ({ date: row.date, close: row.close })).sort((a, b) => a.date.localeCompare(b.date));
    const latest = records.at(-1);
    const previous = records.at(-2);
    const changePoints = latest && previous ? latest.close - previous.close : null;
    return { records, asOfDate: latest?.date ?? null, latestClose: latest?.close ?? null,
        previousDate: previous?.date ?? null, changePoints,
        changePercent: changePoints !== null && previous ? changePoints / previous.close * 100 : null,
        condition: changePoints === null ? "insufficient_data" : changePoints > 0 ? "naik" : changePoints < 0 ? "turun" : "tetap",
        omittedRows: rows.length - records.length };
}
export function rankStocks(stocks: StockOverview[]) {
    return [...stocks].sort((a, b) => b.analysis.investigation.criteriaMet - a.analysis.investigation.criteriaMet
        || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
}
export const isWatchCandidate = (stock: StockOverview) =>
    ["candidate", "unconfirmed"].includes(stock.analysis.investigation.status);

// Injected source makes aggregation testable with no network or server secrets.
export async function loadMarketOverview(source: MarketSource, symbols: readonly string[] = MARKET_CONFIG.symbols): Promise<MarketOverview> {
    if (symbols.length > MARKET_CONFIG.maxSymbols || new Set(symbols).size !== symbols.length || !symbols.every(validTicker)) {
        throw new Error("Universe tidak valid atau melebihi batas MVP.");
    }
    const results = await Promise.allSettled([
        Promise.resolve().then(() => source.index()).then(summarizeIndex),
        ...symbols.map(symbol => Promise.resolve().then(() => source.stock(symbol))),
    ]);
    const failures: MarketOverview["failures"] = [];
    let ihsg: IndexOverview | null = null;
    const indexResult = results[0];
    if (indexResult.status === "fulfilled") {
        ihsg = indexResult.value as IndexOverview;
        if (!ihsg.records.length) failures.push({ symbol: "IHSG", message: "Tidak ada penutupan IHSG yang valid." });
    } else failures.push({ symbol: "IHSG", message: "Data IHSG gagal diambil." });
    const stocks: StockOverview[] = [];
    symbols.forEach((symbol, index) => {
        const result = results[index + 1];
        if (result.status === "rejected") { failures.push({ symbol, message: "Data saham gagal diambil." }); return; }
        const stock = result.value as AnalysisResponse;
        stocks.push({ symbol: stock.symbol, as_of_date: stock.as_of_date, record_count: stock.record_count,
            analysis: stock.analysis, report: stock.report });
    });
    const successful = stocks.length + (ihsg?.records.length ? 1 : 0);
    return { status: !successful ? "error" : failures.length ? "partial" : "complete",
        universe: [...symbols], rankingMethod: MARKET_CONFIG.rankingMethod,
        maxSectorsRequests: marketRequestBudget(symbols.length), estimatedColdCredits: marketCreditEstimate(symbols.length), cacheTtlSeconds: MARKET_CONFIG.dailyCacheTtlSeconds,
        ihsg, stocks: rankStocks(stocks), failures };
}
