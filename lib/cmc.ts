const KEYLESS_BASE = "https://pro-api.coinmarketcap.com/public-api";
const PRO_BASE = "https://pro-api.coinmarketcap.com";

function hasKey() {
  return Boolean(process.env.CMC_API_KEY);
}

/**
 * Proxies a call to the CMC Pro API. Uses the authenticated Pro API when
 * CMC_API_KEY is set (required for the real hackathon submission), and
 * falls back to the no-signup Keyless Public API otherwise so the app is
 * fully runnable with zero setup during development.
 */
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export async function cmcFetch(path: string, params: Record<string, string>) {
  const base = hasKey() ? PRO_BASE : KEYLESS_BASE;
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (hasKey()) headers["X-CMC_PRO_API_KEY"] = process.env.CMC_API_KEY!;

  let lastError: Error | null = null;
  // The Keyless API's FAQ explicitly recommends exponential backoff on 429 —
  // its shared IP-based pool exhausts fast under normal interactive use.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(url.toString(), { headers, next: { revalidate: 30 } });
    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    const body = await res.json();
    if (!res.ok) {
      lastError = new Error(body?.status?.error_message || `CMC API error (${res.status})`);
      break;
    }
    return body;
  }
  throw lastError ?? new Error("CMC API request failed after retries");
}

export function usingKeylessApi() {
  return !hasKey();
}
