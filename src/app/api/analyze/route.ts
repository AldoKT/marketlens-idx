import { NextRequest, NextResponse } from "next/server";
import { analyzeMarket } from "@/lib/analyze";
import { createMarketReport } from "@/lib/report";

const BASE_URL = "https://api.sectors.app/v2";

type PriceRow = {
    symbol: string;
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number;
    volume: number;
};

type FlowRow = {
    date: string;
    net_foreign_inflow: number;
    foreign_share: number | null;
};

type FlowResponse = {
    data: FlowRow[];
};

async function getSectorsData<T>(path: string, apiKey: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: apiKey },
        cache: "force-cache",
        next: { revalidate: 86400 },// 1 day
    });

    if (!response.ok) {
        throw new Error(`Sectors API returned HTTP ${response.status}`);
    }

    return (await response.json()) as T;
}

export async function GET(request: NextRequest) {
    const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();

    if (!symbol || !/^[A-Z]{4}$/.test(symbol)) {
        return NextResponse.json(
            { error: "Gunakan ticker IDX empat huruf, misalnya BBCA." },
            { status: 400 },
        );
    }

    const apiKey = process.env.SECTORS_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: "SECTORS_API_KEY belum tersedia di server." },
            { status: 500 },
        );
    }

    try {
        const [prices, flowResponse] = await Promise.all([
            getSectorsData<PriceRow[]>(`/daily/${symbol}/`, apiKey),
            getSectorsData<FlowResponse>(`/foreign-flow/${symbol}/`, apiKey),
        ]);

        const flowByDate = new Map(
            flowResponse.data.map((row) => [row.date, row]),
        );

        const records = prices
            .filter((price) => flowByDate.has(price.date))
            .map((price) => ({
                ...price,
                net_foreign_inflow:
                    flowByDate.get(price.date)!.net_foreign_inflow,
                foreign_share: flowByDate.get(price.date)!.foreign_share,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
        const analysis = analyzeMarket(records);
        const report = createMarketReport(symbol, analysis);

        return NextResponse.json({
            symbol,
            as_of_date: records.at(-1)?.date ?? null,
            record_count: records.length,
            analysis,
            report,
            records,
        });
    } catch (error) {
        console.error("Sectors request failed:", error);

        return NextResponse.json(
            { error: "Gagal mengambil data Sectors. Periksa terminal server." },
            { status: 502 },
        );
    }
}