import { NextRequest, NextResponse } from "next/server";
import { getStockAnalysis } from "@/lib/sectors";
import { normalizeTicker, validTicker } from "@/lib/market-config";

export async function GET(request: NextRequest) {
    const symbol = normalizeTicker(request.nextUrl.searchParams.get("symbol") ?? "");
    if (!validTicker(symbol)) return NextResponse.json(
        { error: "Gunakan ticker IDX empat huruf, misalnya BBCA." }, { status: 400 });
    const apiKey = process.env.SECTORS_API_KEY;
    if (!apiKey) return NextResponse.json(
        { error: "SECTORS_API_KEY belum tersedia di server." }, { status: 500 });
    try {
        return NextResponse.json(await getStockAnalysis(symbol, apiKey));
    } catch {
        return NextResponse.json({ error: "Gagal mengambil data Sectors. Coba lagi nanti." }, { status: 502 });
    }
}
