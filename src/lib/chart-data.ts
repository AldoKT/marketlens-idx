export type ChartRecord = {
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number;
    volume: number;
};
export type ChartSession = {
    date: string;
    close: number | null;
    candle: { open: number; high: number; low: number; close: number } | null;
    volume: number | null;
    ma5: number | null;
    ma20: number | null;
};
const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
function validDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const time = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}
// No OHLC synthesis, calendar filling, or indicator/network requests.
export function buildChartData(records: ChartRecord[]) {
    const byDate = new Map<string, ChartRecord[]>();
    let invalidDates = 0;
    for (const row of records) {
        if (!validDate(row.date)) { invalidDates++; continue; }
        byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
    }
    let duplicateDates = 0;
    const sessions: ChartSession[] = [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, rows]) => {
            // Duplicate dates are ambiguous: retain an empty slot, not an arbitrary candle.
            if (rows.length !== 1) {
                duplicateDates++;
                return { date, candle: null, close: null, volume: null, ma5: null, ma20: null };
            }
            const row = rows[0];
            const candle = positive(row.open) && positive(row.high) && positive(row.low) && positive(row.close)
                && row.low <= Math.min(row.open, row.close)
                && row.high >= Math.max(row.open, row.close)
                ? { open: row.open, high: row.high, low: row.low, close: row.close } : null;
            return { date, candle, close: positive(row.close) ? row.close : null,
                volume: Number.isFinite(row.volume) && row.volume >= 0 ? row.volume : null, ma5: null, ma20: null };
        });
    for (let i = 0; i < sessions.length; i++) {
        for (const size of [5, 20] as const) {
            if (i + 1 < size) continue;
            const window = sessions.slice(i + 1 - size, i + 1);
            // Do not bridge an invalid close; a fresh complete window is required.
            if (window.every(row => row.close !== null)) {
                sessions[i][size === 5 ? "ma5" : "ma20"] = window.reduce((sum, row) => sum + row.close! / size, 0);
            }
        }
    }
    return { sessions, invalidDates, duplicateDates,
        omittedCandles: sessions.filter(row => row.candle === null).length,
        omittedVolumes: sessions.filter(row => row.volume === null).length };
}
const numbers = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
// Separate series prevent a line interpolating across an unavailable MA window.
export function movingAverageSegments(sessions: ChartSession[], key: "ma5" | "ma20") {
    const segments: { time: string; value: number }[][] = [];
    let current: { time: string; value: number }[] = [];
    for (const row of sessions) {
        if (row[key] === null) { current = []; continue; }
        if (!current.length) segments.push(current);
        current.push({ time: row.date, value: row[key] });
    }
    return segments;
}
export const chartNumber = (value: number | null) => value === null ? "tidak tersedia" : numbers.format(value);
export function sessionDirection(session: ChartSession): string {
    if (!session.candle) return "OHLC tidak tersedia atau tidak valid";
    return session.candle.close > session.candle.open ? "Naik (close > open)"
        : session.candle.close < session.candle.open ? "Turun (close < open)" : "Tetap (close = open)";
}
export function chartSummary(sessions: ChartSession[]): string {
    if (!sessions.length) return "Data grafik belum tersedia: tidak ada tanggal sesi yang valid.";
    const valid = sessions.filter(row => row.close !== null);
    const first = valid[0];
    const latest = valid.at(-1);
    return `${sessions.length} sesi tersedia, ${sessions[0].date} sampai ${sessions.at(-1)!.date}. `
        + (first && latest ? `Close valid pertama Rp${chartNumber(first.close)} (${first.date}), terakhir Rp${chartNumber(latest.close)} (${latest.date}). ` : "Tidak ada close valid. ")
        + `${sessions.filter(row => row.candle !== null).length} candle valid. MA memakai rata-rata close 5/20 sesi, hanya muncul setelah jendela lengkap; bukan sinyal transaksi.`;
}
