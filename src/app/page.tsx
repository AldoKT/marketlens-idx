"use client";

import { FormEvent, useState } from "react";
import { PriceChart } from "@/components/PriceChart";

type AnalysisResponse = {
  symbol: string;
  as_of_date: string | null;
  analysis: {
    price: {
      state: string;
      rangePosition: string;
      rangePercent: number | null;
      netChangePercent: number | null;
    };
    foreignFlow: {
      state: string;
      buyDays: number;
      sessions: number;
      netFlowIdr: number | null;
    };
  };
  report: {
    headline: string;
    summary: string;
    evidence: string[];
    watchNext: string[];
  };
  records: {
    date: string;
    close: number;
  }[];
  error?: string;
};

export default function Home() {
  const [symbol, setSymbol] = useState("BBCA");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/analyze?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`,
      );

      const data = (await response.json()) as AnalysisResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Analisis gagal dimuat.");
      }

      setResult(data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Terjadi kesalahan.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="mb-2 text-sm font-semibold tracking-[0.2em] text-cyan-400">
            SIGNAL
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            IDX Watchlist Intelligence
          </h1>
          <p className="mt-3 text-slate-400">
            Tinjau pergerakan harga dan arus investor asing sebelum sesi berikutnya.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <label htmlFor="ticker" className="sr-only">
            Kode saham
          </label>
          <input
            id="ticker"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            maxLength={4}
            placeholder="BBCA"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 uppercase outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {loading ? "Menganalisis..." : "Analisis"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-950 p-4 text-red-200">
            {error}
          </p>
        )}

        {result && (
          <article className="mt-8 space-y-5">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">
                Data hingga{" "}
                {result.as_of_date
                  ? new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${result.as_of_date}T00:00:00Z`))
                  : "tidak tersedia"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {result.report.headline}
              </h2>
              <p className="mt-4 leading-7 text-slate-300">
                {result.report.summary}
              </p>
            </div>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <PriceChart records={result.records} />
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h3 className="text-lg font-semibold">Bukti dari data</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
                {result.report.evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h3 className="text-lg font-semibold">Pantau sesi berikutnya</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
                {result.report.watchNext.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <p className="text-sm text-slate-500">
              Status dibuat dari aturan prototipe: rentang dan arah harga penutupan
              10 sesi, serta arus asing 5 sesi. Ini bukan instruksi transaksi.
            </p>
          </article>
        )}
      </div>
    </main>
  );
}