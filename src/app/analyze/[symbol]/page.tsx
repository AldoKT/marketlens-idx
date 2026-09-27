import { notFound } from "next/navigation";
import { StockAnalysis } from "@/components/StockAnalysis";
import { normalizeTicker, validTicker } from "@/lib/market-config";

export default async function AnalyzePage({ params }: { params: Promise<{ symbol: string }> }) {
    const symbol = normalizeTicker((await params).symbol);
    if (!validTicker(symbol)) notFound();
    // Only route params are read: visiting or prefetching this page never fetches data.
    return <StockAnalysis key={symbol} symbol={symbol} />;
}
