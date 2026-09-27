import "server-only";
import { MARKET_CONFIG, validTicker } from "./market-config";
import { createStockAnalysis, type PriceRow, type FlowRow } from "./stock-analysis";
import type { IndexRecord } from "./market-overview";

const BASE_URL = "https://api.sectors.app/v2";

// No invocation at import/render time. Identical paths/options share the daily Data Cache.
async function getSectorsData<T>(path: string, apiKey: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: apiKey },
        cache: "force-cache",
        next: { revalidate: MARKET_CONFIG.dailyCacheTtlSeconds },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Sectors HTTP ${response.status}`);
    return await response.json() as T;
}
export async function getStockAnalysis(symbol: string, apiKey: string) {
    if (!validTicker(symbol)) throw new Error("Ticker tidak valid.");
    const [prices, flow] = await Promise.all([
        getSectorsData<PriceRow[]>(`/daily/${symbol}/`, apiKey),
        getSectorsData<{ data: FlowRow[] }>(`/foreign-flow/${symbol}/`, apiKey),
    ]);
    if (!Array.isArray(prices) || !Array.isArray(flow.data)) throw new Error("Format data saham tidak valid.");
    return createStockAnalysis(symbol, prices, flow.data);
}
export async function getIhsgRecords(apiKey: string) {
    const records = await getSectorsData<{ date: string; price: number }[]>("/index-daily/ihsg/", apiKey);
    if (!Array.isArray(records)) throw new Error("Format data IHSG tidak valid.");
    // Sectors names the daily closing level `price`; it has no OHLC.
    return records.map((row): IndexRecord => ({ date: row.date, close: row.price }));
}
