"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildHoldingRows,
  herfindahlIndex,
  concentrationLabel,
  momentumSimilarity,
  portfolioPnl24h,
  sectorBreakdown,
  type Holding,
  type Quote,
} from "@/lib/portfolio";
import { formatUsd, formatPercent, formatCompactNumber } from "@/lib/format";
import { AllocationDonut } from "@/components/AllocationDonut";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";

const DEFAULT_HOLDINGS: Holding[] = [
  { symbol: "BTC", quantity: 0.25 },
  { symbol: "ETH", quantity: 3 },
  { symbol: "SOL", quantity: 40 },
  { symbol: "LINK", quantity: 150 },
];

export function PortfolioDashboard() {
  const [holdings, setHoldings] = useState<Holding[]>(DEFAULT_HOLDINGS);
  const [symbolInput, setSymbolInput] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"keyless" | "pro" | null>(null);
  const [lastCall, setLastCall] = useState<{ url: string; response: unknown } | null>(null);

  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const allSymbols = Array.from(new Set(holdings.map((h) => h.symbol)));
    if (allSymbols.length === 0) return;

    // Only fetch symbols we don't already have cached — the Keyless API's
    // shared IP rate pool exhausts fast if every edit refetches everything.
    // A manual refresh (refreshNonce) forces a full refetch for fresh prices.
    const needed = refreshNonce > 0 ? allSymbols : allSymbols.filter((s) => !(s in quotes));
    if (needed.length === 0) return;

    const url = `/api/quotes?symbols=${encodeURIComponent(needed.join(","))}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-in-effect loading/error reset; the fetch itself is the external sync this effect performs
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Request failed");
        return body;
      })
      .then((body) => {
        setQuotes((prev) => ({ ...prev, ...body.quotes }));
        setSource(body.source);
        setLastCall({ url, response: body });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, refreshNonce]);

  const rows = useMemo(() => buildHoldingRows(holdings, quotes), [holdings, quotes]);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const pnl24h = useMemo(() => portfolioPnl24h(rows), [rows]);
  const sectors = useMemo(() => sectorBreakdown(rows), [rows]);
  const holdingHhi = useMemo(() => herfindahlIndex(rows.map((r) => r.weight)), [rows]);
  const sectorHhi = useMemo(() => herfindahlIndex(sectors.map((s) => s.weight)), [sectors]);

  const correlation = useMemo(() => {
    const symbols = rows.map((r) => r.symbol);
    const matrix = symbols.map((_, i) => symbols.map((_, j) => momentumSimilarity(rows[i].quote, rows[j].quote)));
    return { symbols, matrix };
  }, [rows]);

  function addHolding(e: React.FormEvent) {
    e.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    const quantity = Number(qtyInput);
    if (!symbol || !Number.isFinite(quantity) || quantity <= 0) return;
    setHoldings((prev) => {
      const existing = prev.findIndex((h) => h.symbol === symbol);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = { symbol, quantity: copy[existing].quantity + quantity };
        return copy;
      }
      return [...prev, { symbol, quantity }];
    });
    setSymbolInput("");
    setQtyInput("");
  }

  function removeHolding(symbol: string) {
    setHoldings((prev) => prev.filter((h) => h.symbol !== symbol));
  }

  return (
    <div className="w-full max-w-[880px] mx-auto flex flex-col gap-6 pb-20">
      <form onSubmit={addHolding} className="flex flex-wrap gap-2 items-end bg-panel border border-line rounded-xl p-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-fg-subtle font-mono">Symbol</label>
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder="BTC"
            className="bg-input border border-line rounded-lg px-3 py-2 text-[13px] font-mono text-fg w-28 placeholder:text-fg-subtle"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-fg-subtle font-mono">Quantity</label>
          <input
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            placeholder="1.5"
            inputMode="decimal"
            className="bg-input border border-line rounded-lg px-3 py-2 text-[13px] font-mono text-fg w-28 placeholder:text-fg-subtle"
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-accent-fg text-[13px] font-mono font-medium rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Add holding
        </button>
        {loading && <span className="text-[11px] font-mono text-fg-subtle self-center ml-2">loading…</span>}
        {holdings.length > 0 && (
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
            disabled={loading}
            className="text-[12px] font-mono text-fg-muted border border-line rounded-lg px-3 py-2 hover:text-fg hover:border-fg-subtle transition-colors disabled:opacity-40"
          >
            Refresh prices
          </button>
        )}
      </form>

      {error && (
        <p className="text-[12px] font-mono text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {holdings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {holdings.map((h) => {
            const hasQuote = Boolean(quotes[h.symbol]);
            return (
              <span
                key={h.symbol}
                className={`flex items-center gap-2 bg-panel border rounded-full pl-3 pr-2 py-1 text-[12px] font-mono ${
                  hasQuote ? "border-line text-fg" : "border-danger/40 text-fg-subtle"
                }`}
              >
                {h.symbol} × {h.quantity}
                {!hasQuote && <span className="text-danger">{loading ? "loading…" : "no data"}</span>}
                <button
                  onClick={() => removeHolding(h.symbol)}
                  className="text-fg-subtle hover:text-fg w-4 h-4 flex items-center justify-center rounded-full hover:bg-line/50"
                  aria-label={`Remove ${h.symbol}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total value" value={formatUsd(totalValue)} />
        <StatCard
          label="24h P&L"
          value={`${formatUsd(pnl24h.absolute, { compact: true })}`}
          sub={formatPercent(pnl24h.percent)}
          tone={pnl24h.absolute >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Holding concentration"
          value={concentrationLabel(holdingHhi)}
          sub={`HHI ${holdingHhi.toFixed(2)}`}
        />
        <StatCard
          label="Sector concentration"
          value={concentrationLabel(sectorHhi)}
          sub={`HHI ${sectorHhi.toFixed(2)}`}
        />
      </div>

      <Section title="Allocation by holding">
        {rows.length > 0 ? (
          <AllocationDonut slices={rows.map((r) => ({ label: r.symbol, weight: r.weight }))} />
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Sector exposure">
        {sectors.length > 0 ? (
          <div className="flex flex-col gap-2">
            {sectors.map((s) => (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="w-32 text-[12px] font-mono text-fg-muted shrink-0">{s.sector}</span>
                <div className="flex-1 h-2 rounded-full bg-ring-track overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${s.weight * 100}%` }} />
                </div>
                <span className="w-14 text-[12px] font-mono text-fg text-right">{(s.weight * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Section>

      <Section
        title="Momentum correlation"
        subtitle="Cosine similarity of 1h/24h/7d/30d/60d/90d % change — a proxy for return correlation that needs no historical OHLCV call."
      >
        <CorrelationHeatmap symbols={correlation.symbols} matrix={correlation.matrix} />
      </Section>

      <Section title="Holdings">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-mono">
              <thead>
                <tr className="text-fg-subtle text-left">
                  <th className="pb-2 font-normal">Asset</th>
                  <th className="pb-2 font-normal">Sector</th>
                  <th className="pb-2 font-normal text-right">Price</th>
                  <th className="pb-2 font-normal text-right">24h</th>
                  <th className="pb-2 font-normal text-right">Value</th>
                  <th className="pb-2 font-normal text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} className="border-t border-line">
                    <td className="py-2 text-fg">{r.symbol}</td>
                    <td className="py-2 text-fg-muted">{r.quote.sector}</td>
                    <td className="py-2 text-right text-fg">{formatUsd(r.quote.price)}</td>
                    <td
                      className={`py-2 text-right ${r.quote.percentChange["24h"] >= 0 ? "text-positive" : "text-danger"}`}
                    >
                      {formatPercent(r.quote.percentChange["24h"])}
                    </td>
                    <td className="py-2 text-right text-fg">{formatUsd(r.value)}</td>
                    <td className="py-2 text-right text-fg-muted">{(r.weight * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Section>

      {lastCall && (
        <Section
          title="API evidence"
          subtitle={`Live call to CMC's ${source === "pro" ? "authenticated Pro" : "no-signup Keyless"} API — /v3/cryptocurrency/quotes/latest`}
        >
          <details className="text-[11px] font-mono">
            <summary className="cursor-pointer text-fg-muted">Show request &amp; raw response</summary>
            <p className="mt-2 text-fg-subtle break-all">GET {lastCall.url}</p>
            <pre className="mt-2 bg-input border border-line rounded-lg p-3 overflow-x-auto max-h-64 text-fg-muted">
              {JSON.stringify(lastCall.response, null, 2).slice(0, 4000)}
            </pre>
          </details>
        </Section>
      )}

      <p className="text-[11px] font-mono text-fg-subtle text-center">
        Data: {formatCompactNumber(rows.length)} asset{rows.length === 1 ? "" : "s"} tracked live via CoinMarketCap ·
        source: {source ?? "…"}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-4 flex flex-col gap-1">
      <span className="text-[11px] font-mono text-fg-subtle">{label}</span>
      <span className="text-[18px] font-medium text-fg">{value}</span>
      {sub && (
        <span
          className={`text-[11px] font-mono ${tone === "positive" ? "text-positive" : tone === "negative" ? "text-danger" : "text-fg-muted"}`}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <h2 className="text-[14px] font-medium text-fg mb-1">{title}</h2>
      {subtitle && <p className="text-[11px] font-mono text-fg-subtle mb-3">{subtitle}</p>}
      <div className={subtitle ? "mt-3" : "mt-2"}>{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-[12px] font-mono text-fg-subtle">Add a holding to see this section come alive.</p>;
}
