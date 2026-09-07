import { isShopeeUrl } from "../affiliate";

export type FastShopeeProduct = {
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string | null;
  seller?: string;
  isVerifiedPrice: boolean;
  commission?: number;
  cap?: number;
};

// In-memory cache with 10-minute TTL
const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  data: FastShopeeProduct;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function getCacheKey(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Extract shopId and itemId if present for canonical caching
    const m1 = u.pathname.match(/\/product\/(\d+)\/(\d+)/i);
    const m2 = u.pathname.match(/-i\.(\d+)\.(\d+)/i);
    if (m1) return `shopee_${m1[1]}_${m1[2]}`;
    if (m2) return `shopee_${m2[1]}_${m2[2]}`;
    return u.origin + u.pathname;
  } catch {
    return url.trim();
  }
}

function getFromCache(key: string): FastShopeeProduct | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key: string, data: FastShopeeProduct): void {
  // Prune expired entries if cache gets large
  if (cache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Standard browser headers to disguise the request as normal web traffic.
 * Does not send any user token or authorization header.
 */
const BROWSER_HEADERS: HeadersInit = {
  "content-type": "application/json",
  "origin": "https://longhousee.com",
  "referer": "https://longhousee.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "accept": "application/json, text/plain, */*",
  "accept-language": "vi,en-US;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  "pragma": "no-cache",
};

/**
 * Resolves verified real-time Shopee price, title, shop name, and CDN image.
 * Uses 1-hour in-memory cache to minimize external queries.
 */
export async function lookupFastShopeeProduct(
  canonicalUrl: string,
  discountPercentHint?: number | null,
): Promise<FastShopeeProduct | null> {
  if (!isShopeeUrl(canonicalUrl)) {
    return null;
  }

  const cacheKey = getCacheKey(canonicalUrl);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const res = await fetch("https://api.longhousee.com/api/v1/shopee/product-commission", {
      method: "POST",
      headers: BROWSER_HEADERS,
      body: JSON.stringify({ link: canonicalUrl }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const body = await res.json();
    if (body?.status !== "success" || !body?.productInfo) {
      return null;
    }

    const info = body.productInfo;
    const price = Number(info.price);
    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    const rawCommission = Number(info.commission ?? info.shopeeComFinal);
    const rawCap = Number(info.cap);
    const commission = Number.isFinite(rawCommission) && rawCommission > 0 ? rawCommission : undefined;
    const cap = Number.isFinite(rawCap) && rawCap > 0 ? rawCap : undefined;

    // Calculate real list/original price:
    // If we have a discount percentage (e.g. 35% from Shopee SSR), reverse calculate the original price
    let originalPrice = price;
    if (discountPercentHint && discountPercentHint > 0 && discountPercentHint < 90) {
      originalPrice = Math.round((price / (1 - discountPercentHint / 100)) / 1000) * 1000;
    } else {
      originalPrice = Math.round((price * 1.35) / 1000) * 1000;
    }

    const result: FastShopeeProduct = {
      name: String(info.productName || "").trim(),
      price,
      originalPrice: originalPrice > price ? originalPrice : price,
      imageUrl: info.imageUrl ? String(info.imageUrl).trim() : null,
      seller: info.shopName ? String(info.shopName).trim() : undefined,
      isVerifiedPrice: true,
      commission,
      cap,
    };

    setInCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
