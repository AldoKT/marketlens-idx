type PricePoint = {
    date: string;
    close: number;
};

export function PriceChart({ records }: { records: PricePoint[] }) {
    const points = records.slice(-10);

    if (points.length < 2) {
        return <p className="text-slate-400">Data grafik belum cukup.</p>;
    }

    const width = 600;
    const height = 220;
    const left = 48;
    const right = 18;
    const top = 20;
    const bottom = 42;

    const prices = points.map((point) => point.close);
    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    const padding = Math.max((maximum - minimum) * 0.15, 1);
    const yMin = minimum - padding;
    const yMax = maximum + padding;

    const x = (index: number) =>
        left + (index / (points.length - 1)) * (width - left - right);

    const y = (price: number) =>
        top + ((yMax - price) / (yMax - yMin)) * (height - top - bottom);

    const line = points
        .map((point, index) => `${x(index)},${y(point.close)}`)
        .join(" ");

    const latest = points.at(-1)!;

    return (
        <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold">Harga penutupan · 10 sesi</h3>
                <span className="text-sm text-slate-400">
                    Terakhir Rp{latest.close.toLocaleString("id-ID")}
                </span>
            </div>

            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`Grafik harga penutupan 10 sesi, dari Rp${points[0].close} menjadi Rp${latest.close}`}
                className="h-auto w-full"
            >
                <line
                    x1={left}
                    y1={y(maximum)}
                    x2={width - right}
                    y2={y(maximum)}
                    stroke="#334155"
                    strokeDasharray="4 5"
                />
                <line
                    x1={left}
                    y1={y(minimum)}
                    x2={width - right}
                    y2={y(minimum)}
                    stroke="#334155"
                    strokeDasharray="4 5"
                />

                <text x={4} y={y(maximum) + 4} fill="#94a3b8" fontSize={12}>
                    {maximum.toLocaleString("id-ID")}
                </text>
                <text x={4} y={y(minimum) + 4} fill="#94a3b8" fontSize={12}>
                    {minimum.toLocaleString("id-ID")}
                </text>

                <polyline
                    points={line}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {points.map((point, index) => (
                    <circle
                        key={point.date}
                        cx={x(index)}
                        cy={y(point.close)}
                        r={index === points.length - 1 ? 5 : 3}
                        fill="#22d3ee"
                    >
                        <title>
                            {point.date}: Rp{point.close.toLocaleString("id-ID")}
                        </title>
                    </circle>
                ))}

                <text x={left} y={height - 8} fill="#94a3b8" fontSize={12}>
                    {points[0].date.slice(5)}
                </text>
                <text
                    x={width - right}
                    y={height - 8}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize={12}
                >
                    {latest.date.slice(5)}
                </text>
            </svg>

            <p className="mt-2 text-xs text-slate-500">
                Garis putus-putus menunjukkan penutupan tertinggi dan terendah dalam
                jendela ini; keduanya bukan level support atau resistance yang tervalidasi.
            </p>
        </div>
    );
}