import { MARKET_CONFIG } from "../../src/lib/market-config";
import { createStockAnalysis, type AnalysisResponse } from "../../src/lib/stock-analysis";
import type { IndexRecord, MarketSource } from "../../src/lib/market-overview";

// Fictional prices/flows under universe labels, never historical BBCA data.
const dates = Array.from({ length: 26 }, (_, i) => new Date(Date.UTC(2026, 8, i)))
    .filter(date => ![0, 6].includes(date.getUTCDay())).map(date => date.toISOString().slice(0, 10));
// A deterministic synthetic path with reversals exercises chart scaling/hover.
// Keep the last two values stable for the existing two-session comparison checks.
export const indexFixture: IndexRecord[] = dates.map((date, i) => ({ date, close: 7000 + i * 5 + (i < dates.length - 2 ? Math.round(Math.sin(i * 0.8) * 24) : 0) }));
export function stockFixture(symbol: string, mode = "full"): AnalysisResponse {
    const reviewCloses = symbol === "BBRI" ? [109, 111, 108, 110, 106, 105, 107, 104, 102, 103]
        : symbol === "TLKM" ? [110, 112, 111, 113, 110, 109, 107, 105, 103, 105]
        : [112, 110, 111, 108, 109, 106, 107, 104, 105, 103];
    const closes = mode === "review" ? reviewCloses : [100, 102, 101, 103, 102, 101, 102, 101, 100, 100];
    const prices = dates.map((date, i) => {
        const close = mode === "empty" ? 100 + 10 * i : closes[i % 10];
        return { symbol, date, open: close + (i % 2 ? -1 : 1), high: close + 2, low: close - 2,
            close, volume: i < 10 ? 1000 : 1500 };
    });
    // Force the last 10 to the candidate pattern even with an odd total count.
    if (mode !== "empty") prices.slice(-10).forEach((row, i) => {
        row.close = closes[i]; row.open = row.close + (i % 2 ? -1 : 1); row.high = row.close + 2; row.low = row.close - 2;
    });
    const selected = mode === "short" ? prices.slice(-3) : prices;
    const flows = selected.map(row => ({ date: row.date, net_foreign_inflow: symbol === "TLKM" || ["empty", "review"].includes(mode) ? -1_000_000 : 2_000_000, foreign_share: 0.5 }));
    return createStockAnalysis(symbol, selected, flows);
}
export function marketFixtureSource(mode = "full"): MarketSource {
    return {
        index: async () => {
            if (["error", "index-error"].includes(mode)) throw new Error("Fixture index failure");
            return mode === "index-empty" ? [] : indexFixture;
        },
        stock: async symbol => {
            if (mode === "error" || (mode === "partial" && symbol === MARKET_CONFIG.symbols[1])) throw new Error("Fixture stock failure");
            return stockFixture(symbol, mode);
        },
    };
}
