import type { MarketAnalysis } from "./analyze";

export type MarketReport = {
    headline: string;
    summary: string;
    evidence: string[];
    watchNext: string[];
    supportingEvidence: string[];
    contradictingEvidence: string[];
    missingChecks: { news: "belum diperiksa"; corporateAction: "belum diperiksa"; fundamentals: "belum diperiksa"; sector: "belum diperiksa" };
    signal: {
        spot: string;
        investigate: string[];
        gauge: string;
        narrative: string;
        assess: string;
        lookAhead: string[];
    };
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

    const { investigation, volume, periods } = analysis;
    const supportingEvidence: string[] = [];
    const contradictingEvidence: string[] = [];
    const describePeriod = (period: typeof periods.price) =>
        `${period.startDate ?? "tidak tersedia"} sampai ${period.endDate ?? "tidak tersedia"} (${period.sessions} sesi)`;
    const metric = (value: number | null) => value === null ? "tidak tersedia" : numberId.format(value);
    const criterionDetails = {
        sideways: `Harga ${describePeriod(periods.price)}: rentang Rp${metric(price.lowestClose)}–Rp${metric(price.highestClose)}, lebar ${metric(price.rangePercent)}%, perubahan awal-akhir ${metric(price.netChangePercent)}%.`,
        lower_range: `Penutupan terakhir pada ${analysis.asOfDate ?? "tanggal tidak tersedia"}: posisi ${metric(price.positionPercent)}% dalam rentang ${describePeriod(periods.price)}.`,
        foreign_buying: `Arus asing ${describePeriod(periods.foreignFlow)}: ${foreignFlow.buyDays} sesi net buy, ${foreignFlow.sellDays} sesi net sell, total bersih Rp${metric(foreignFlow.netFlowIdr)}.`,
    };
    const investigate = investigation.criteria.map(criterion => {
        const detail = `${criterionDetails[criterion.id]} Aturan: ${criterion.rule}`;
        if (criterion.met === true) supportingEvidence.push(detail);
        if (criterion.met === false) contradictingEvidence.push(detail);
        return `${criterion.met === null ? "Belum dapat dinilai" : criterion.met ? "Terpenuhi" : "Tidak terpenuhi"}: ${detail}`;
    });
    const volumeText = volume.state === "available"
        ? `Rata-rata volume ${describePeriod(volume.recentPeriod)}: ${metric(volume.recentAverage)}; sebelumnya ${describePeriod(volume.previousPeriod)}: ${metric(volume.previousAverage)}. Rasio ${metric(volume.ratio)}; perubahan ${metric(volume.changePercent)}%${volume.previousAverage === 0 ? " (baseline nol; rasio dan persentase tidak terdefinisi)" : ""}.`
        : `Volume belum cukup atau tidak valid untuk perbandingan 5 lawan 5 sesi: terakhir ${describePeriod(volume.recentPeriod)}, sebelumnya ${describePeriod(volume.previousPeriod)}.`;
    const gauge = `${volumeText} Volume adalah konteks, bukan bukti otomatis akumulasi dan tidak dihitung sebagai kriteria kandidat.`;
    evidence.push(...investigate, gauge);
    const assess = `Status ${investigation.status}; ${investigation.criteriaMet}/${investigation.criteriaTotal} kriteria terpenuhi. Kandidat adalah pola untuk investigasi, bukan konfirmasi akumulasi, bukti manipulasi, atau probabilitas cuan.`;
    const narrative = `${priceText} ${flowText} Berita, corporate action, fundamental, dan sektor belum diperiksa. Penyebab harga dan katalis belum dapat disimpulkan.`;
    watchNext.push(
        "Periksa berita, corporate action, fundamental, dan sektor sebelum menyusun penjelasan sebab harga.",
        "Evaluasi ulang rentang 10 sesi, posisi harga, arus asing 5 sesi, dan konteks volume saat data sesi baru tersedia.",
    );
    const spot = `${symbol}: Sideways Accumulation Watch — ${investigation.status} (${investigation.criteriaMet}/3 kriteria).`;

    return {
        headline: spot,
        summary: `${narrative} ${assess}`,
        evidence,
        watchNext,
        supportingEvidence,
        contradictingEvidence,
        missingChecks: { news: "belum diperiksa", corporateAction: "belum diperiksa", fundamentals: "belum diperiksa", sector: "belum diperiksa" },
        signal: { spot, investigate, gauge, narrative, assess, lookAhead: [...watchNext] },
    };
}
