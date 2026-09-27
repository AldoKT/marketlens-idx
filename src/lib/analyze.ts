export type MarketRecord = {
    date: string;
    close: number;
    volume: number;
    net_foreign_inflow: number;
};

type PriceState = "sideways" | "rising" | "falling" | "wide_range" | "insufficient_data";
type RangePosition = "lower" | "middle" | "upper" | "insufficient_data";
type FlowState = "buying_pattern" | "selling_pattern" | "mixed" | "insufficient_data";

export type SessionPeriod = { startDate: string | null; endDate: string | null; sessions: number };
export type InvestigationStatus = "candidate" | "unconfirmed" | "not_matching" | "insufficient_data";
export type WatchCriterion = {
    id: "sideways" | "lower_range" | "foreign_buying";
    met: boolean | null;
    rule: string;
};

export type MarketAnalysis = {
    asOfDate: string | null;
    periods: { price: SessionPeriod; foreignFlow: SessionPeriod };
    volume: {
        state: "available" | "insufficient_data";
        recentPeriod: SessionPeriod;
        previousPeriod: SessionPeriod;
        recentAverage: number | null;
        previousAverage: number | null;
        ratio: number | null;
        changePercent: number | null;
        role: "context_only";
    };
    investigation: {
        name: "Sideways Accumulation Watch";
        status: InvestigationStatus;
        criteriaMet: number;
        criteriaTotal: number;
        criteria: WatchCriterion[];
    };
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
    const previous5 = last10.slice(0, Math.max(0, last10.length - 5));
    const period = (rows: MarketRecord[]): SessionPeriod => ({
        startDate: rows[0]?.date ?? null,
        endDate: rows.at(-1)?.date ?? null,
        sessions: rows.length,
    });
    const uniqueSessions = (rows: MarketRecord[]) => new Set(rows.map(row => row.date)).size === rows.length;

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
        uniqueSessions(last10) &&
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
        uniqueSessions(last5) &&
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

    const volume: MarketAnalysis["volume"] = {
        state: "insufficient_data",
        recentPeriod: period(last5),
        previousPeriod: period(previous5),
        recentAverage: null,
        previousAverage: null,
        ratio: null,
        changePercent: null,
        role: "context_only",
    };
    if (last10.length === 10 && uniqueSessions(last10) &&
        last10.every(row => Number.isFinite(row.volume) && row.volume >= 0)) {
        volume.state = "available";
        volume.recentAverage = last5.reduce((sum, row) => sum + row.volume / 5, 0);
        volume.previousAverage = previous5.reduce((sum, row) => sum + row.volume / 5, 0);
        // Baseline nol: rasio dan perubahan persentase tidak terdefinisi.
        if (volume.previousAverage > 0) {
            volume.ratio = volume.recentAverage / volume.previousAverage;
            volume.changePercent = (volume.ratio - 1) * 100;
        }
    }
    const criteria: WatchCriterion[] = [
        { id: "sideways", met: price.state === "insufficient_data" ? null : price.state === "sideways",
            rule: "10 sesi: rentang <= 5% dan perubahan awal-akhir absolut <= 2%." },
        { id: "lower_range", met: price.rangePosition === "insufficient_data" ? null : price.rangePosition === "lower",
            rule: "Posisi penutupan terakhir <= 30% dari rentang penutupan 10 sesi." },
        { id: "foreign_buying", met: foreignFlow.state === "insufficient_data" ? null : foreignFlow.state === "buying_pattern",
            rule: "5 sesi: minimal 3 sesi net buy dan total arus asing > 0." },
    ];
    const criteriaMet = criteria.filter(item => item.met === true).length;
    const status: InvestigationStatus = criteria.some(item => item.met === null)
        ? "insufficient_data" : criteriaMet === 3 ? "candidate"
            : criteriaMet > 0 ? "unconfirmed" : "not_matching";

    return {
        asOfDate: sorted.at(-1)?.date ?? null,
        periods: { price: period(last10), foreignFlow: period(last5) },
        volume,
        investigation: { name: "Sideways Accumulation Watch", status, criteriaMet, criteriaTotal: 3, criteria },
        price,
        foreignFlow,
    };
}
