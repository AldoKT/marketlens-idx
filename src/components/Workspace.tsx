import Link from "next/link";

export const criterionLabels = { sideways: "Harga sideways", lower_range: "Posisi bawah rentang", foreign_buying: "Pola beli asing" };
export function MarketLensBrand() {
    return <Link href="/" prefetch={false} className="signal-brand" aria-label="MarketLens beranda"><span aria-hidden="true" className="signal-mark"><i /><i /><i /></span>MarketLens<span className="brand-caption">POST-MARKET STOCK INTELLIGENCE</span></Link>;
}
export function InvestigationStatus({ status }: { status: string }) {
    return <span className={`status-chip status-${status}`}><span aria-hidden="true">{status === "candidate" ? "✓" : status === "unconfirmed" ? "◐" : "○"}</span> {status}</span>;
}
