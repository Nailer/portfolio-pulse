import { NextRequest, NextResponse } from "next/server";
import { cmcFetch, usingKeylessApi } from "@/lib/cmc";
import { primarySector } from "@/lib/categories";
import type { Quote } from "@/lib/portfolio";

type CmcTag = { slug: string; name: string; category: string };
type CmcQuoteEntry = { price: number; percent_change_1h: number; percent_change_24h: number; percent_change_7d: number; percent_change_30d: number; percent_change_60d: number; percent_change_90d: number; market_cap: number };
type CmcCoin = {
  symbol: string;
  name: string;
  tags: CmcTag[];
  quote: CmcQuoteEntry[];
  cmc_rank: number | null;
  is_active: 0 | 1;
};

/**
 * Thousands of listed tokens share tickers with well-known assets (scam
 * clones, wrapped/bridged variants, dead forks — e.g. querying "BTC" also
 * returns entries like "Bitcoin Gold AI" and "Bridged BTC (NEAR Intents)").
 * The API has no "give me the canonical one" flag for symbol lookups, so we
 * pick the best candidate per symbol ourselves: active first, then lowest
 * cmc_rank (real market leaders are always ranked; clones are usually
 * rank=null), then highest market cap as a final tiebreak.
 */
function pickCanonical(candidates: CmcCoin[]): CmcCoin {
  return candidates.reduce((best, c) => {
    if (best.is_active !== c.is_active) return c.is_active ? c : best;
    const bestRank = best.cmc_rank ?? Infinity;
    const rank = c.cmc_rank ?? Infinity;
    if (rank !== bestRank) return rank < bestRank ? c : best;
    const bestCap = best.quote[0]?.market_cap ?? 0;
    const cap = c.quote[0]?.market_cap ?? 0;
    return cap > bestCap ? c : best;
  });
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing ?symbols=BTC,ETH,..." }, { status: 400 });
  }
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols provided" }, { status: 400 });
  }

  try {
    const body = await cmcFetch("/v3/cryptocurrency/quotes/latest", {
      symbol: symbols.join(","),
      convert: "USD",
    });

    const coins: CmcCoin[] = Array.isArray(body.data) ? body.data : Object.values(body.data ?? {});
    const bySymbol = new Map<string, CmcCoin[]>();
    for (const coin of coins) {
      const list = bySymbol.get(coin.symbol) ?? [];
      list.push(coin);
      bySymbol.set(coin.symbol, list);
    }

    const quotes: Record<string, Quote> = {};
    for (const [symbol, candidates] of bySymbol) {
      const coin = pickCanonical(candidates);
      const usdQuote = coin.quote[0];
      if (!usdQuote) continue;
      quotes[symbol] = {
        symbol: coin.symbol,
        name: coin.name,
        price: usdQuote.price,
        marketCap: usdQuote.market_cap,
        percentChange: {
          "1h": usdQuote.percent_change_1h,
          "24h": usdQuote.percent_change_24h,
          "7d": usdQuote.percent_change_7d,
          "30d": usdQuote.percent_change_30d,
          "60d": usdQuote.percent_change_60d,
          "90d": usdQuote.percent_change_90d,
        },
        sector: primarySector(coin.tags ?? []),
      };
    }

    const missing = symbols.filter((s) => !quotes[s]);

    return NextResponse.json({
      quotes,
      missing,
      source: usingKeylessApi() ? "keyless" : "pro",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error calling CMC API";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
