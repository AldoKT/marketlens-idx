import type { MarketAnalysis, WatchCriterion } from "@/lib/analyze";
import { chartNumber } from "@/lib/chart-data";

// Presentation only: classification always comes from criterion.met / investigation.status.
export function criterionFact(analysis: MarketAnalysis, criterion: WatchCriterion) {
    const { price, foreignFlow } = analysis;
    if (criterion.met === null) return { metric: "—", detail: "Data belum cukup untuk menilai kriteria ini.", brief: "Belum dapat dinilai" };
    switch (criterion.id) {
        case "sideways": return {
            metric: `${chartNumber(price.rangePercent)}%`,
            detail: `Rentang ${chartNumber(price.rangePercent)}%; perubahan ${chartNumber(price.netChangePercent)}% dalam ${price.sessions} sesi.`,
            brief: criterion.met ? `Sideways · rentang ${chartNumber(price.rangePercent)}%` : `Kriteria sideways belum terpenuhi · rentang ${chartNumber(price.rangePercent)}%`,
        };
        case "lower_range": return {
            metric: `${chartNumber(price.positionPercent)}%`,
            detail: `Posisi ${chartNumber(price.positionPercent)}% dari rentang Rp${chartNumber(price.lowestClose)}–Rp${chartNumber(price.highestClose)}.`,
            brief: criterion.met ? `Posisi bawah · ${chartNumber(price.positionPercent)}% rentang` : `Posisi bawah belum terpenuhi · ${chartNumber(price.positionPercent)}% rentang`,
        };
        case "foreign_buying": return {
            metric: `${foreignFlow.buyDays}/${foreignFlow.sessions}`,
            detail: `${foreignFlow.buyDays} sesi net buy; arus bersih Rp${chartNumber(foreignFlow.netFlowIdr)} dalam ${foreignFlow.sessions} sesi.`,
            brief: criterion.met ? `Pola beli asing · ${foreignFlow.buyDays}/${foreignFlow.sessions} sesi net buy` : `Pola beli asing belum terpenuhi · ${foreignFlow.buyDays}/${foreignFlow.sessions} sesi net buy`,
        };
    }
}

export function shortlistFacts(analysis: MarketAnalysis) {
    const criteria = analysis.investigation.criteria;
    const support = criteria.find(item => item.met === true);
    const counter = criteria.find(item => item.met === false);
    return {
        support: support ? criterionFact(analysis, support).brief : "Belum ada kriteria terpenuhi",
        counter: counter ? criterionFact(analysis, counter).brief : criteria.some(item => item.met === null) ? "Sebagian kriteria belum dapat dinilai" : "Kriteria lengkap; akumulasi belum terkonfirmasi",
    };
}
