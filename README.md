# Portfolio Pulse

A live crypto portfolio dashboard built for the [Build with CMC: API Hackathon](https://dorahacks.io/hackathon/coinmarketcap-api-202609/detail) — **Markets and Trading Tools** track.

Enter your holdings and get, in real time: total value, 24h P&L, sector exposure, a concentration/diversification score, and a momentum-correlation heatmap between your assets — all backed by live CoinMarketCap data.

## Why this, not another AI-agent risk scorer

We read through 41 existing hackathon submissions before starting. Real World Assets and AI Agents & Automation were both saturated with near-identical "trust/risk score for a tokenized asset" tools. Nobody had built the plain, explicitly-invited "portfolio and PnL tracker" from the Markets and Trading Tools track description — so that's what this is.

## CMC API endpoints used

- `GET /v3/cryptocurrency/quotes/latest` — live price, market cap, and `percent_change_{1h,24h,7d,30d,60d,90d}` for every holding, plus the `tags` array used to classify each asset's primary sector.

That's the only endpoint this app calls. Everything else — allocation, P&L, concentration risk, sector exposure, and the momentum-correlation heatmap — is computed client-side from that one response, on purpose: it works on the free Keyless tier with zero setup, and it means a single API call powers the whole dashboard.

## An "interesting use of the API" note

True return correlation normally needs a paid historical-OHLCV endpoint. Since every `quotes/latest` call already returns percent-change across six windows (1h through 90d) for free, we treat that six-number vector as each asset's "momentum fingerprint" and compute cosine similarity between fingerprints as a correlation proxy. It's not identical to price-series correlation, but it's directionally meaningful, costs nothing extra, and needs no historical endpoint at all.

## A real bug we hit and fixed

Querying `quotes/latest?symbol=BTC` doesn't return only Bitcoin — it returns every listed token that happens to share the ticker `BTC` (we counted 13, including things like "Bitcoin Gold AI" and "Bridged BTC (NEAR Intents)"). The API has no "give me the canonical one" flag for symbol lookups. Our first version silently displayed one of the impersonator coins as if it were real Bitcoin. `app/api/quotes/route.ts` now disambiguates explicitly: prefer `is_active`, then lowest `cmc_rank`, then highest market cap. This is exactly the kind of thing we'd flag in the hackathon's API-feedback section — see below.

## Architecture

- **Next.js 16 (App Router) + Tailwind 4**, deployed on Vercel.
- `app/api/quotes/route.ts` is a server-side proxy — the Pro API is deliberately CORS-blocked from browsers to protect API keys, so all calls go through this route, never the client directly.
- `lib/cmc.ts` targets the no-signup **Keyless Public API** (`pro-api.coinmarketcap.com/public-api`) by default, and switches to the authenticated Pro API automatically the moment a `CMC_API_KEY` env var is set — same code path, no other changes needed.
- Requests retry with exponential backoff on `429`, per CMC's own FAQ guidance — the Keyless tier's shared IP-rate pool exhausts fast under normal interactive use, and we hit it ourselves during development.
- The dashboard only fetches symbols it doesn't already have cached, to avoid multiplying request volume on every holdings edit; a manual "Refresh prices" button forces a full refetch when you actually want fresh data.

## Running locally

```bash
npm install
npm run dev
```

No API key needed — it runs immediately against the Keyless Public API. To use an authenticated key (required for the real Startup-tier hackathon submission and for higher rate limits), set `CMC_API_KEY` in a `.env.local` file.

## API feedback (as requested by the hackathon)

- **What it made possible:** a full portfolio dashboard — value, P&L, sector exposure, concentration risk, momentum correlation — from a single free, keyless endpoint. That's a very low floor to build something real.
- **Where it got in the way:** symbol lookups return every ticker collision with no way to ask for "the real one" — see the bug section above. This is worth a documented `is_active`/`cmc_rank` disambiguation recipe in the quick-start guide, since it's an easy trap for a first-time integrator to fall into unnoticed.
- **Rate limits:** the Keyless tier's shared pool is generous for a single request but exhausts quickly across a normal edit-and-refresh UI loop; we had to add incremental fetching and 429 backoff to stay usable during development.
