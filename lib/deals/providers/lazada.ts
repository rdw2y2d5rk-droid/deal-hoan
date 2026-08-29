import { FETCH_TIMEOUT_MS } from "../config";
import { cashbackFor, dealScore } from "../score";
import type { Deal, DealProvider } from "../types";

/**
 * Lazada's own search page loads results through this public JSON endpoint —
 * confirmed reachable with a plain server-side `fetch`, no login, no key, no
 * browser automation. (Shopee and TikTok Shop have no equivalent: Shopee
 * login-walls even a real browser session, and TikTok Shop has no browsable
 * desktop catalog to read.)
 *
 * This provider returns REAL product data (name/price/image/sold/rating), but
 * `productUrl` is the plain Lazada link, not an affiliate one — converting it
 * to a tracked link happens at click time in `/api/go`, once Lazada affiliate
 * credentials are wired into `lib/deals/linkers/lazada.ts`.
 */
const CATALOG_URL = "https://www.lazada.vn/catalog/";

const QUERIES = [
  "nồi chiên không dầu",
  "robot hút bụi",
  "serum dưỡng da",
  "giày chạy bộ",
  "máy xay sinh tố",
  "bàn phím cơ",
  "kem chống nắng",
  "bình giữ nhiệt",
  "tai nghe bluetooth",
  "nồi cơm điện",
];

type LazadaItem = {
  itemId?: string;
  name?: string;
  price?: string;
  originalPrice?: string;
  discount?: string;
  ratingScore?: string;
  review?: string;
  itemSoldCntShow?: string;
  image?: string;
  itemUrl?: string;
  sellerName?: string;
};

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** "605 Đã bán" / "2.1K Đã bán" -> 605 / 2100 */
function parseSold(text?: string): number | null {
  if (!text) return null;
  const m = text.match(/([\d.,]+)\s*(K)?/i);
  if (!m) return null;
  const base = Number(m[1].replace(",", "."));
  if (!Number.isFinite(base)) return null;
  return Math.round(m[2] ? base * 1000 : base);
}

async function search(query: string): Promise<LazadaItem[]> {
  const url = `${CATALOG_URL}?${new URLSearchParams({
    ajax: "true",
    isFirstRequest: "true",
    page: "1",
    q: query,
  })}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json",
      // Without this Lazada serves English listing titles by default.
      "Accept-Language": "vi-VN,vi;q=0.9",
      Cookie: "hng=VN|vi|VND|704;",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Lazada search "${query}" failed: ${res.status}`);
  const body = (await res.json()) as { mods?: { listItems?: LazadaItem[] } };
  return body.mods?.listItems ?? [];
}

function normalise(item: LazadaItem): Deal | null {
  const price = num(item.price);
  if (!item.itemId || !item.name || !price) return null;

  const originalPrice = num(item.originalPrice) > price ? num(item.originalPrice) : price;
  const discountPercent = originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;
  const cashback = cashbackFor(price, "Lazada");
  const sold = parseSold(item.itemSoldCntShow);
  const ratingAverage = num(item.ratingScore);
  const reviewCount = num(item.review);

  const productUrl = item.itemUrl
    ? item.itemUrl.startsWith("http")
      ? item.itemUrl
      : `https:${item.itemUrl}`
    : "https://www.lazada.vn/";

  return {
    id: `lazada-${item.itemId}`,
    name: item.name,
    platform: "Lazada",
    seller: item.sellerName ?? "Lazada",
    price,
    originalPrice,
    discountPercent,
    cashback,
    dealScore: dealScore({ discountPercent, price, cashback, ratingAverage, reviewCount, sold }),
    sold,
    ratingAverage,
    reviewCount,
    imageUrl: item.image ?? null,
    productUrl,
  };
}

export const lazadaProvider: DealProvider = {
  id: "lazada",

  // Lazada's catalog search is public — always available, no credentials needed.
  isConfigured: () => true,

  async fetchDeals() {
    const batches = await Promise.allSettled(QUERIES.map(search));

    const byId = new Map<string, LazadaItem>();
    for (const batch of batches) {
      if (batch.status !== "fulfilled") continue;
      for (const item of batch.value) {
        if (item.itemId && num(item.originalPrice) > num(item.price)) {
          byId.set(item.itemId, item);
        }
      }
    }

    if (byId.size === 0) throw new Error("Lazada returned no discounted products");

    return [...byId.values()].map(normalise).filter((d): d is Deal => d !== null);
  },
};
