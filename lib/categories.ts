/**
 * Curated allowlist mapping CMC tag slugs to a single "primary sector" bucket.
 * CMC returns dozens of tags per asset (VC portfolios, algorithms, etc.) —
 * we only care about a handful of sector-defining ones for the exposure chart.
 * Order matters: first match wins, ordered roughly most → least specific.
 */
const SECTOR_TAGS: Array<{ slug: string; label: string }> = [
  { slug: "real-world-assets-rwa", label: "Real World Assets" },
  { slug: "stablecoin", label: "Stablecoins" },
  { slug: "layer-1", label: "Layer 1" },
  { slug: "layer-2", label: "Layer 2" },
  { slug: "artificial-intelligence", label: "AI" },
  { slug: "ai-agents", label: "AI" },
  { slug: "gaming", label: "Gaming" },
  { slug: "metaverse", label: "Metaverse" },
  { slug: "nft", label: "NFT" },
  { slug: "decentralized-finance-defi", label: "DeFi" },
  { slug: "defi", label: "DeFi" },
  { slug: "oracle", label: "Oracles" },
  { slug: "privacy-coins", label: "Privacy" },
  { slug: "meme", label: "Meme" },
  { slug: "store-of-value", label: "Store of Value" },
  { slug: "decentralized-exchange", label: "DEX" },
  { slug: "exchange-based-tokens", label: "Exchange Tokens" },
  { slug: "payments", label: "Payments" },
];

export function primarySector(tags: Array<{ slug: string }>): string {
  const slugs = new Set(tags.map((t) => t.slug));
  for (const { slug, label } of SECTOR_TAGS) {
    if (slugs.has(slug)) return label;
  }
  return "Other";
}
