export type MarketRecord = {
    date: string;
    close: number;
    volume: number;
    net_foreign_inflow: number;
};

type PriceState = "sideways" | "rising" | "falling" | "wide_range" | "insufficient_data";
type RangePosition = "lower" | "middle" | "upper" | "insufficient_data";
type FlowState = "buying_pattern" | "selling_pattern" | "mixed" | "insufficient_data";

export type MarketAnalysis = {
    asOfDate: string | null;
    price: {
        state: PriceState;
        rangePosition: RangePosition;
        sessions: number;
        lowestClose: number | null;
        highestClose: number | null;
        rangePercent: number | null;
        positionPercent: number | null;
        netChangePercent: number | null;

    };
    foreignFlow: {
        state: FlowState;
        sessions: number;
        buyDays: number;
        sellDays: number;
        netFlowIdr: number | null;
    };
};

export function analyzeMarket(records: MarketRecord[]): MarketAnalysis {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const last10 = sorted.slice(-10);
    const last5 = sorted.slice(-5);

    const price = {
        state: "insufficient_data" as PriceState,
        rangePosition: "insufficient_data" as RangePosition,
        sessions: last10.length,
        lowestClose: null as number | null,
        highestClose: null as number | null,
        rangePercent: null as number | null,
        positionPercent: null as number | null,
        netChangePercent: null as number | null,
    };

    if (
        last10.length === 10 &&
        last10.every((row) => Number.isFinite(row.close) && row.close > 0)
    ) {
        const closes = last10.map((row) => row.close);
        const lowest = Math.min(...closes);
        const highest = Math.max(...closes);
        const latest = last10.at(-1)!.close;
        const first = last10[0].close;
        const netChangePercent = ((latest - first) / first) * 100;

        const rangePercent = ((highest - lowest) / lowest) * 100;
        const positionPercent =
            highest === lowest
                ? 50 // Semua penutupan sama; posisinya tidak punya arah.
                : ((latest - lowest) / (highest - lowest)) * 100;

        price.lowestClose = lowest;
        price.highestClose = highest;
        price.rangePercent = rangePercent;
        price.positionPercent = positionPercent;
        price.netChangePercent = netChangePercent;

        price.state =
            rangePercent <= 5 && Math.abs(netChangePercent) <= 2
                ? "sideways"
                : netChangePercent > 2
                    ? "rising"
                    : netChangePercent < -2
                        ? "falling"
                        : "wide_range";
        price.rangePosition =
            positionPercent <= 30
                ? "lower"
                : positionPercent >= 70
                    ? "upper"
                    : "middle";
    }

    const foreignFlow = {
        state: "insufficient_data" as FlowState,
        sessions: last5.length,
        buyDays: 0,
        sellDays: 0,
        netFlowIdr: null as number | null,
    };

    if (
        last5.length === 5 &&
        last5.every((row) => Number.isFinite(row.net_foreign_inflow))
    ) {
        const netFlowIdr = last5.reduce(
            (sum, row) => sum + row.net_foreign_inflow,
            0,
        );

        const buyDays = last5.filter(
            (row) => row.net_foreign_inflow > 0,
        ).length;

        const sellDays = last5.filter(
            (row) => row.net_foreign_inflow < 0,
        ).length;

        foreignFlow.buyDays = buyDays;
        foreignFlow.sellDays = sellDays;
        foreignFlow.netFlowIdr = netFlowIdr;
        foreignFlow.state =
            buyDays >= 3 && netFlowIdr > 0
                ? "buying_pattern"
                : sellDays >= 3 && netFlowIdr < 0
                    ? "selling_pattern"
                    : "mixed";
    }

    return {
        asOfDate: sorted.at(-1)?.date ?? null,
        price,
        foreignFlow,
    };
}