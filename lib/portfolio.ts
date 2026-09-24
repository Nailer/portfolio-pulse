export type Quote = {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  percentChange: {
    "1h": number;
    "24h": number;
    "7d": number;
    "30d": number;
    "60d": number;
    "90d": number;
  };
  sector: string;
};

export type Holding = { symbol: string; quantity: number };

export type HoldingRow = Holding & {
  quote: Quote;
  value: number;
  weight: number;
};

/** Herfindahl-Hirschman Index over a set of weights (0-1 fractions). Ranges 0 (max diversified) to 1 (single holding). */
export function herfindahlIndex(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w * w, 0);
}

/** Maps an HHI score to a human risk label. Thresholds mirror common finance-industry HHI bands (antitrust uses 0.15/0.25; we tune down since a 2-3 asset crypto book is normal). */
export function concentrationLabel(hhi: number): "Diversified" | "Moderate" | "Concentrated" {
  if (hhi < 0.2) return "Diversified";
  if (hhi < 0.4) return "Moderate";
  return "Concentrated";
}

const CHANGE_WINDOWS: Array<keyof Quote["percentChange"]> = ["1h", "24h", "7d", "30d", "60d", "90d"];

/**
 * Cosine similarity between two assets' percent-change vectors across the six
 * windows CMC returns on every quote. Two assets that have been moving the
 * same direction by similar magnitudes across timeframes score close to 1;
 * assets moving independently or oppositely score near 0 or negative.
 * This approximates return correlation without needing a paid historical
 * OHLCV endpoint — every quote call already carries the inputs for free.
 */
export function momentumSimilarity(a: Quote, b: Quote): number {
  const va = CHANGE_WINDOWS.map((w) => a.percentChange[w]);
  const vb = CHANGE_WINDOWS.map((w) => b.percentChange[w]);
  const dot = va.reduce((s, x, i) => s + x * vb[i], 0);
  const magA = Math.sqrt(va.reduce((s, x) => s + x * x, 0));
  const magB = Math.sqrt(vb.reduce((s, x) => s + x * x, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export function buildHoldingRows(holdings: Holding[], quotes: Record<string, Quote>): HoldingRow[] {
  const rows = holdings
    .filter((h) => quotes[h.symbol])
    .map((h) => {
      const quote = quotes[h.symbol];
      return { ...h, quote, value: quote.price * h.quantity, weight: 0 };
    });
  const total = rows.reduce((s, r) => s + r.value, 0);
  return rows.map((r) => ({ ...r, weight: total > 0 ? r.value / total : 0 }));
}

export function sectorBreakdown(rows: HoldingRow[]): Array<{ sector: string; value: number; weight: number }> {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const bySector = new Map<string, number>();
  for (const r of rows) {
    bySector.set(r.quote.sector, (bySector.get(r.quote.sector) ?? 0) + r.value);
  }
  return Array.from(bySector.entries())
    .map(([sector, value]) => ({ sector, value, weight: total > 0 ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function portfolioPnl24h(rows: HoldingRow[]): { absolute: number; percent: number } {
  const totalNow = rows.reduce((s, r) => s + r.value, 0);
  const totalPrior = rows.reduce((s, r) => s + r.value / (1 + r.quote.percentChange["24h"] / 100), 0);
  const absolute = totalNow - totalPrior;
  const percent = totalPrior > 0 ? (absolute / totalPrior) * 100 : 0;
  return { absolute, percent };
}
