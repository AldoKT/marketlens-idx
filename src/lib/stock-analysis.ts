import { analyzeMarket, type MarketAnalysis } from "./analyze";
import { createMarketReport, type MarketReport } from "./report";
import type { ChartRecord } from "./chart-data";

export type PriceRow = ChartRecord & { symbol: string };
export type FlowRow = { date: string; net_foreign_inflow: number; foreign_share: number | null };
export type AnalysisRecord = PriceRow & Omit<FlowRow, "date">;
export type AnalysisResponse = {
    symbol: string;
    as_of_date: string | null;
    record_count: number;
    analysis: MarketAnalysis;
    report: MarketReport;
    records: AnalysisRecord[];
};

// Same date intersection and investigation/report functions as Sessions 1–2.
export function createStockAnalysis(symbol: string, prices: PriceRow[], flows: FlowRow[]): AnalysisResponse {
    const flowByDate = new Map(flows.map(row => [row.date, row]));
    const records = prices.filter(price => flowByDate.has(price.date)).map(price => ({
        ...price,
        net_foreign_inflow: flowByDate.get(price.date)!.net_foreign_inflow,
        foreign_share: flowByDate.get(price.date)!.foreign_share,
    })).sort((a, b) => a.date.localeCompare(b.date));
    const analysis = analyzeMarket(records);
    return { symbol, as_of_date: records.at(-1)?.date ?? null, record_count: records.length,
        analysis, report: createMarketReport(symbol, analysis), records };
}
