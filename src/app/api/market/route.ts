import { NextResponse } from "next/server";
import { loadMarketOverview } from "@/lib/market-overview";
import { getIhsgRecords, getStockAnalysis } from "@/lib/sectors";

// POST prevents link prefetch, rendering, and page navigation from loading market data.
export async function POST() {
    const apiKey = process.env.SECTORS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "SECTORS_API_KEY belum tersedia di server." }, { status: 500 });
    const overview = await loadMarketOverview({
        index: () => getIhsgRecords(apiKey), stock: symbol => getStockAnalysis(symbol, apiKey),
    });
    // Partial and total upstream errors remain structured for the landing page.
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
}
