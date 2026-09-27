import type { ChartRecord } from "../../src/lib/chart-data";

// Synthetic TEST data only; not historical BBCA observations.
export const chartFixture: ChartRecord[] = Array.from({ length: 30 }, (_, i) => {
    const close = 100 + i;
    return {
        date: new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10),
        open: close + (i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0),
        high: close + 2,
        low: close - 2,
        close,
        volume: 1000 + i * 100,
    };
});
export const invalidChartFixture = chartFixture.map((row, i) => ({ ...row,
    open: i === 2 ? null : row.open,
    high: i === 3 ? row.close - 3 : row.high,
    close: i === 6 ? NaN : row.close,
    volume: i === 8 ? -1 : row.volume,
}));
