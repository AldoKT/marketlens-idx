import type { MarketAnalysis } from "./analyze";

export type MarketReport = {
    headline: string;
    summary: string;
    evidence: string[];
    watchNext: string[];
};

const numberId = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
});

function formatIdr(value: number): string {
    const absolute = Math.abs(value);

    if (absolute >= 1_000_000_000_000) {
        return `${numberId.format(value / 1_000_000_000_000)} triliun`;
    }

    if (absolute >= 1_000_000_000) {
        return `${numberId.format(value / 1_000_000_000)} miliar`;
    }

    return numberId.format(value);
}

export function createMarketReport(
    symbol: string,
    analysis: MarketAnalysis,
): MarketReport {
    const { price, foreignFlow } = analysis;
    const evidence: string[] = [];
    const watchNext: string[] = [];

    let priceText = "Data harga belum cukup untuk dianalisis.";

    if (
        price.state !== "insufficient_data" &&
        price.netChangePercent !== null &&
        price.lowestClose !== null &&
        price.highestClose !== null
    ) {
        const direction = {
            sideways: "bergerak relatif mendatar",
            rising: "cenderung naik",
            falling: "cenderung turun",
            wide_range: "bergerak dalam rentang yang lebar",
        }[price.state];

        const position = {
            lower: "bagian bawah",
            middle: "bagian tengah",
            upper: "bagian atas",
        }[price.rangePosition as "lower" | "middle" | "upper"];

        priceText = `Harga penutupan ${direction} dalam ${price.sessions} sesi dan kini berada di ${position} rentang pengamatan.`;

        evidence.push(
            `Perubahan awal–akhir ${price.sessions} sesi: ${numberId.format(price.netChangePercent)}%.`,
            `Rentang penutupan: Rp${numberId.format(price.lowestClose)}–Rp${numberId.format(price.highestClose)}.`,
        );

        if (price.rangePosition === "lower") {
            watchNext.push(
                "Periksa apakah harga tetap bertahan di area bawah rentang pengamatan.",
            );
        }
    }

    let flowText = "Data arus asing belum cukup untuk dianalisis.";

    if (
        foreignFlow.state !== "insufficient_data" &&
        foreignFlow.netFlowIdr !== null
    ) {
        if (foreignFlow.state === "buying_pattern") {
            flowText = "Arus beli asing tampak berlanjut dalam lima sesi terakhir.";
        } else if (foreignFlow.state === "selling_pattern") {
            flowText = "Arus asing lima sesi terakhir masih condong ke penjualan bersih.";
        } else {
            flowText = "Arus asing lima sesi terakhir belum menunjukkan arah yang konsisten.";
        }

        const flowDirection =
            foreignFlow.netFlowIdr > 0
                ? "net buy"
                : foreignFlow.netFlowIdr < 0
                    ? "net sell"
                    : "netral";

        evidence.push(
            `Investor asing net buy ${foreignFlow.buyDays} dari ${foreignFlow.sessions} sesi; total ${flowDirection} Rp${formatIdr(Math.abs(foreignFlow.netFlowIdr))}.`,
        );

        watchNext.push(
            "Pantau apakah arah arus asing berlanjut pada sesi perdagangan berikutnya.",
        );
    }

    const headline =
        price.state === "sideways" &&
            foreignFlow.state === "buying_pattern"
            ? `${symbol}: sideways dengan indikasi arus beli asing`
            : `${symbol}: kondisi perlu ditinjau`;

    return {
        headline,
        summary: `${priceText} ${flowText}`,
        evidence,
        watchNext,
    };
}