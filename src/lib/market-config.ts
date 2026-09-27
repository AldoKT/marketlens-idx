// One bounded universe shared by the UI, loader, and offline fixtures.
export const MARKET_CONFIG = {
    symbols: ["BBCA", "BBRI", "TLKM"] as readonly string[],
    maxSymbols: 5,
    dailyCacheTtlSeconds: 86_400,
    creditsPerEndpoint: { index: 1, daily: 1, foreignFlow: 1 },
    rankingMethod: "Jumlah kriteria terpenuhi menurun; jika seri, ticker A–Z. Hanya candidate/unconfirmed masuk daftar pantauan; status lain ditampilkan terpisah.",
} as const;

export const marketRequestBudget = (size = MARKET_CONFIG.symbols.length) => 1 + 2 * size;
export const marketCreditEstimate = (size = MARKET_CONFIG.symbols.length) =>
    MARKET_CONFIG.creditsPerEndpoint.index + size * (MARKET_CONFIG.creditsPerEndpoint.daily + MARKET_CONFIG.creditsPerEndpoint.foreignFlow);
export const normalizeTicker = (value: string) => value.trim().toUpperCase();
export const validTicker = (value: string) => /^[A-Z]{4}$/.test(value);
